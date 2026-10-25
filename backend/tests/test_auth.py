from .conftest import account, vehicle


def test_register_login_and_protected_route(client):
    assert client.get("/api/vehicles").status_code == 401
    headers = account(client)
    assert client.get("/api/vehicles", headers=headers).status_code == 200
    login = client.post("/api/auth/login", json={"email": "BUYER@example.com", "password": "StrongPass123!"})
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "user"
    assert client.get("/api/vehicles", headers={"Authorization": "Bearer broken"}).status_code == 401


def test_duplicate_and_invalid_credentials(client):
    account(client)
    assert client.post("/api/auth/register", json={"email": "BUYER@example.com", "password": "StrongPass123!"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "buyer@example.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/register", json={"email": "bad", "password": "short"}).status_code == 422
