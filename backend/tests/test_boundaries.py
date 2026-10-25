from datetime import datetime, timedelta, timezone

import jwt
import pytest

from .conftest import account, admin, vehicle


@pytest.mark.parametrize("value", ["100000000000000000000", "-1"])
def test_oversized_or_invalid_vehicle_id_is_validation_error(client, value):
    headers = admin(client)
    assert client.delete(f"/api/vehicles/{value}", headers=headers).status_code == 422
    assert client.post(f"/api/vehicles/{value}/purchase", headers=headers).status_code == 422
    assert client.post(f"/api/vehicles/{value}/restock", json={"amount": 1}, headers=headers).status_code == 422


def test_oversized_quantity_and_price_query_are_validation_errors(client):
    headers = admin(client)
    assert client.post("/api/vehicles", headers=headers, json=vehicle(quantity=10**30)).status_code == 422
    assert client.get("/api/vehicles/search?min_price=1e30", headers=headers).status_code == 422


def test_fractional_cent_search_uses_inclusive_exact_boundaries(client):
    headers = admin(client)
    client.post("/api/vehicles", headers=headers, json=vehicle(price=100.00))
    assert client.get("/api/vehicles/search?min_price=100.005", headers=headers).status_code == 422
    assert client.get("/api/vehicles/search?max_price=99.999", headers=headers).status_code == 422
    assert len(client.get("/api/vehicles/search?min_price=100&max_price=100", headers=headers).json()) == 1


@pytest.mark.parametrize("email", ["a b@c.d", "@@x.y", "missing-at-sign"])
def test_invalid_email_rejected(client, email):
    assert client.post("/api/auth/register", json={"email": email, "password": "StrongPass123!"}).status_code == 422


def test_missing_exp_claim_rejected_and_deleted_user_revoked(client, monkeypatch):
    headers = account(client)
    from app.db import connect
    with connect() as db:
        user_id = db.execute("SELECT id FROM users WHERE email = ?", ("buyer@example.com",)).fetchone()[0]
    unsigned_exp = jwt.encode({"sub": str(user_id)}, "test-secret-only-for-hmac-sha256-testing", algorithm="HS256")
    assert client.get("/api/vehicles", headers={"Authorization": f"Bearer {unsigned_exp}"}).status_code == 401
    with connect() as db:
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    assert client.get("/api/vehicles", headers=headers).status_code == 401


def test_missing_vehicle_restock_and_search_filters(client):
    headers = admin(client)
    assert client.post("/api/vehicles/99/restock", json={"amount": 1}, headers=headers).status_code == 404
    car = client.post("/api/vehicles", headers=headers, json=vehicle(model="Civic %", price=100)).json()
    assert client.get("/api/vehicles/search?model=Civic%20%25&min_price=100", headers=headers).json()[0]["id"] == car["id"]
    assert client.get("/api/vehicles/search?model=%25", headers=headers).json()[0]["id"] == car["id"]
    assert client.get("/api/vehicles/search?model=_", headers=headers).json() == []


def test_general_search_matches_make_model_or_category(client):
    headers = admin(client)
    client.post("/api/vehicles", headers=headers, json=vehicle(make="Volvo", model="XC60", category="SUV"))
    client.post("/api/vehicles", headers=headers, json=vehicle(make="Honda", model="Civic", category="Sedan"))
    for term in ("volv", "xc60", "suv"):
        response = client.get("/api/vehicles/search", params={"q": term}, headers=headers)
        assert [car["model"] for car in response.json()] == ["XC60"]


def test_restock_cannot_exceed_editable_quantity_limit(client):
    headers = admin(client)
    item = client.post("/api/vehicles", headers=headers, json=vehicle(quantity=1_000_000)).json()
    result = client.post(f"/api/vehicles/{item['id']}/restock", headers=headers, json={"amount": 1})
    assert result.status_code == 409
    assert client.get("/api/vehicles", headers=headers).json()[0]["quantity"] == 1_000_000
    assert client.put(f"/api/vehicles/{item['id']}", headers=headers, json=vehicle(quantity=1_000_000, price=50)).status_code == 200
