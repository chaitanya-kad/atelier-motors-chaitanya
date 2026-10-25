from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import create_app
from .conftest import account, admin, vehicle


def test_only_one_buyer_gets_the_last_vehicle(client):
    owner = admin(client)
    buyer = account(client)
    item = client.post("/api/vehicles", headers=owner, json=vehicle(quantity=1)).json()

    def buy(_):
        with TestClient(create_app()) as other_client:
            return other_client.post(f"/api/vehicles/{item['id']}/purchase", headers=buyer).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(buy, range(2)))
    assert sorted(results) == [200, 409]
    assert client.get("/api/vehicles", headers=owner).json()[0]["quantity"] == 0


def test_data_survives_new_app_instance(client):
    owner = admin(client)
    item = client.post("/api/vehicles", headers=owner, json=vehicle()).json()
    with TestClient(create_app()) as restarted:
        assert restarted.get("/api/vehicles", headers=owner).json()[0]["id"] == item["id"]
