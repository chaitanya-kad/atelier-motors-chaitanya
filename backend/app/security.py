"""Password hashing and short-lived signed access tokens."""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split(":")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600_000)
        return hmac.compare_digest(candidate, bytes.fromhex(digest))
    except (ValueError, TypeError):
        return False


def secret() -> str:
    value = os.getenv("JWT_SECRET")
    if not value or len(value) < 12:
        raise RuntimeError("Set JWT_SECRET to a random string of at least 12 characters")
    return value


def issue_token(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, secret(), algorithm="HS256")


def token_user_id(token: str) -> int:
    payload = jwt.decode(token, secret(), algorithms=["HS256"])
    return int(payload["sub"])
