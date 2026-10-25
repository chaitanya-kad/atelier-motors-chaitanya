from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient

from app.main import create_app
from app.inventory import OutOfStock, change_stock
from .conftest import account, admin, vehicle


def test_data_survives_new_app_instance(client):
    owner = admin(client)
    item = client.post("/api/vehicles", headers=owner, json=vehicle()).json()
    with TestClient(create_app()) as restarted:
        assert restarted.get("/api/vehicles", headers=owner).json()[0]["id"] == item["id"]


def test_twenty_buyers_cannot_oversell_five_units(client):
    owner = admin(client)
    item = client.post("/api/vehicles", headers=owner, json=vehicle(quantity=5)).json()
    gate = Barrier(20)

    def buy(_):
        gate.wait(timeout=10)
        try:
            change_stock(item["id"], -1)
            return "purchased"
        except OutOfStock:
            return "sold out"

    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(buy, range(20)))
    assert results.count("purchased") == 5
    assert results.count("sold out") == 15
    assert client.get("/api/vehicles", headers=owner).json()[0]["quantity"] == 0
