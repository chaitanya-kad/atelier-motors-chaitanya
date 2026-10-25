"""REST API. Inventory mutations use conditional SQL updates for atomicity."""

import sqlite3
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
import jwt

from .db import connect, init_db
from .inventory import OutOfStock, StockLimitExceeded, VehicleMissing, change_stock
from .security import DUMMY_PASSWORD_HASH, hash_password, issue_token, token_user_id, verify_password


VehicleId = Annotated[int, Path(ge=1, le=2**63 - 1)]
PriceLimit = Annotated[Decimal | None, Query(ge=0, le=9_999_999_999.99, max_digits=12, decimal_places=2)]


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()


class LoginCredentials(Credentials):
    password: str


class VehicleInput(BaseModel):
    make: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    quantity: int = Field(ge=0, le=1_000_000)

    @field_validator("make", "model", "category")
    @classmethod
    def trim_nonempty(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Must not be blank")
        return value


class RestockInput(BaseModel):
    amount: int = Field(gt=0, le=1_000_000)


def present(row):
    return {"id": row["id"], "make": row["make"], "model": row["model"],
            "category": row["category"], "price": row["price_cents"] / 100,
            "quantity": row["quantity"]}


bearer = HTTPBearer(auto_error=False)


def current_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    try:
        user_id = token_user_id(credentials.credentials)
    except (ValueError, KeyError, jwt.PyJWTError) as exc:
        # Invalid, expired, and malformed JWTs all receive the same response.
        raise HTTPException(401, "Invalid or expired token") from exc
    with connect() as db:
        user = db.execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if user is None:
        raise HTTPException(401, "Invalid or expired token")
    return dict(user)


def admin_user(user: Annotated[dict, Depends(current_user)]):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def get_vehicle(db, vehicle_id):
    row = db.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Vehicle not found")
    return present(row)


def create_app():
    @asynccontextmanager
    async def lifespan(_app):
        from .security import secret
        secret()
        init_db()
        yield

    app = FastAPI(title="Atelier Motors API", version="1.0.0", lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        # Pydantic includes raw input in errors, which may be a password.
        errors = [{key: value for key, value in error.items() if key not in {"input", "ctx"}} for error in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": errors})

    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                       allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    @app.post("/api/auth/register", status_code=201)
    def register(body: Credentials):
        with connect() as db:
            try:
                cursor = db.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)",
                                    (body.email, hash_password(body.password)))
            except sqlite3.IntegrityError as exc:
                raise HTTPException(409, "Email already registered") from exc
            user_id = cursor.lastrowid
        return {"token": issue_token(user_id), "user": {"id": user_id, "email": body.email, "role": "user"}}

    @app.post("/api/auth/login")
    def login(body: LoginCredentials):
        with connect() as db:
            row = db.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
        valid = verify_password(body.password, row["password_hash"] if row else DUMMY_PASSWORD_HASH)
        if row is None or not valid:
            raise HTTPException(401, "Invalid email or password")
        return {"token": issue_token(row["id"]), "user": {"id": row["id"], "email": row["email"], "role": row["role"]}}

    @app.get("/api/vehicles")
    def list_vehicles(_user: Annotated[dict, Depends(current_user)]):
        with connect() as db:
            return [present(row) for row in db.execute("SELECT * FROM vehicles ORDER BY id DESC")]

    @app.get("/api/vehicles/search")
    def search(_user: Annotated[dict, Depends(current_user)], q: str | None = None,
               make: str | None = None, model: str | None = None,
               category: str | None = None, min_price: PriceLimit = None,
               max_price: PriceLimit = None):
        if min_price is not None and max_price is not None and min_price > max_price:
            raise HTTPException(422, "Minimum price cannot exceed maximum price")
        clauses, values = [], []
        def pattern(value):
            return "%" + value.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"

        if q:
            clauses.append("(LOWER(make) LIKE ? ESCAPE '\\' OR LOWER(model) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\')")
            values.extend([pattern(q)] * 3)
        for field, value in (("make", make), ("model", model), ("category", category)):
            if value:
                clauses.append(f"LOWER({field}) LIKE ? ESCAPE '\\'")
                values.append(pattern(value))
        if min_price is not None:
            clauses.append("price_cents >= ?")
            values.append(int(min_price * 100))
        if max_price is not None:
            clauses.append("price_cents <= ?")
            values.append(int(max_price * 100))
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with connect() as db:
            return [present(row) for row in db.execute("SELECT * FROM vehicles" + where + " ORDER BY id DESC", values)]

    @app.post("/api/vehicles", status_code=201)
    def add_vehicle(body: VehicleInput, _admin: Annotated[dict, Depends(admin_user)]):
        with connect() as db:
            cursor = db.execute("INSERT INTO vehicles (make, model, category, price_cents, quantity) VALUES (?, ?, ?, ?, ?)",
                                (body.make, body.model, body.category, int(body.price * 100), body.quantity))
            return get_vehicle(db, cursor.lastrowid)

    @app.put("/api/vehicles/{vehicle_id}")
    def update_vehicle(vehicle_id: VehicleId, body: VehicleInput, _admin: Annotated[dict, Depends(admin_user)]):
        with connect() as db:
            cursor = db.execute("UPDATE vehicles SET make=?, model=?, category=?, price_cents=?, quantity=? WHERE id=?",
                                (body.make, body.model, body.category, int(body.price * 100), body.quantity, vehicle_id))
            if cursor.rowcount == 0:
                raise HTTPException(404, "Vehicle not found")
            return get_vehicle(db, vehicle_id)

    @app.delete("/api/vehicles/{vehicle_id}", status_code=204)
    def delete_vehicle(vehicle_id: VehicleId, _admin: Annotated[dict, Depends(admin_user)]):
        with connect() as db:
            if db.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,)).rowcount == 0:
                raise HTTPException(404, "Vehicle not found")

    @app.post("/api/vehicles/{vehicle_id}/purchase")
    def purchase(vehicle_id: VehicleId, _user: Annotated[dict, Depends(current_user)]):
        try:
            return present(change_stock(vehicle_id, -1))
        except OutOfStock as exc:
            raise HTTPException(409, "Out of stock") from exc
        except VehicleMissing as exc:
            raise HTTPException(404, "Vehicle not found") from exc

    @app.post("/api/vehicles/{vehicle_id}/restock")
    def restock(vehicle_id: VehicleId, body: RestockInput, _admin: Annotated[dict, Depends(admin_user)]):
        try:
            return present(change_stock(vehicle_id, body.amount))
        except StockLimitExceeded as exc:
            raise HTTPException(409, "Restock exceeds the 1,000,000-unit limit") from exc
        except VehicleMissing as exc:
            raise HTTPException(404, "Vehicle not found") from exc

    return app


app = create_app()
