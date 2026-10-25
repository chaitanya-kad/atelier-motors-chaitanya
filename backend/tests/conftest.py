import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "inventory.db"))
    monkeypatch.setenv("JWT_SECRET", "test-secret-only")
    with TestClient(create_app()) as test_client:
        yield test_client


def account(client, email="buyer@example.com", password="StrongPass123!"):
    response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def admin(client):
    from app.db import connect
    headers = account(client, "admin@example.com")
    with connect() as db:
        db.execute("UPDATE users SET role = 'admin' WHERE email = ?", ("admin@example.com",))
    return headers


def vehicle(**overrides):
    return {"make": "Honda", "model": "Civic", "category": "Sedan", "price": 24500.50, "quantity": 2} | overrides
