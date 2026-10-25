from .conftest import account, admin, vehicle


def test_admin_crud_and_search(client):
    owner = admin(client)
    buyer = account(client)
    assert client.post("/api/vehicles", json=vehicle(), headers=buyer).status_code == 403
    created = client.post("/api/vehicles", json=vehicle(), headers=owner)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["price"] == 24500.5
    assert client.get("/api/vehicles/search?make=hON&max_price=25000", headers=buyer).json()[0]["id"] == item["id"]
    assert client.get("/api/vehicles/search?category=SUV", headers=buyer).json() == []
    assert client.put(f"/api/vehicles/{item['id']}", json=vehicle(price=23000, quantity=5), headers=owner).json()["quantity"] == 5
    assert client.delete(f"/api/vehicles/{item['id']}", headers=buyer).status_code == 403
    assert client.delete(f"/api/vehicles/{item['id']}", headers=owner).status_code == 204
    assert client.delete(f"/api/vehicles/{item['id']}", headers=owner).status_code == 404


def test_atomic_purchase_and_restock(client):
    owner = admin(client)
    buyer = account(client)
    item = client.post("/api/vehicles", json=vehicle(quantity=1), headers=owner).json()
    url = f"/api/vehicles/{item['id']}"
    assert client.post(url + "/purchase", headers=buyer).json()["quantity"] == 0
    assert client.post(url + "/purchase", headers=buyer).status_code == 409
    assert client.post(url + "/restock", json={"amount": 2}, headers=buyer).status_code == 403
    assert client.post(url + "/restock", json={"amount": 2}, headers=owner).json()["quantity"] == 2
    assert client.post(url + "/restock", json={"amount": 0}, headers=owner).status_code == 422


def test_validation_and_missing_vehicle(client):
    owner = admin(client)
    assert client.post("/api/vehicles", json=vehicle(price=-1), headers=owner).status_code == 422
    assert client.post("/api/vehicles", json=vehicle(quantity=-1), headers=owner).status_code == 422
    assert client.get("/api/vehicles/search?min_price=300&max_price=100", headers=owner).status_code == 422
    assert client.put("/api/vehicles/999", json=vehicle(), headers=owner).status_code == 404
    assert client.post("/api/vehicles/999/purchase", headers=owner).status_code == 404
