from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import create


def login(username, password):
    anonymous = TestClient(app)
    response = anonymous.post("/api/auth/login", json={"username": username, "password": password})
    return anonymous, response


def as_user(client, username, role):
    create(client, "/api/auth/users", username=username, role=role, password="secret1", full_name=username)
    anonymous, response = login(username, "secret1")
    anonymous.headers["Authorization"] = f"Bearer {response.json()['token']}"
    return anonymous


def test_requests_without_token_are_rejected(client):
    assert TestClient(app).get("/api/patients").status_code == 401


def test_default_admin_login_and_wrong_password(client):
    _, ok = login("admin", "admin")
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "admin"
    assert login("admin", "nope")[1].status_code == 401


def test_roles_limit_access(client):
    pharmacist = as_user(client, "pharma1", "pharmacist")
    assert pharmacist.get("/api/pharmacy/stock").status_code == 200
    assert pharmacist.post("/api/patients", json={"name": "X"}).status_code == 403
    assert pharmacist.get("/api/billing/bills").status_code == 403
    assert pharmacist.get("/api/auth/users").status_code == 403
    biller = as_user(client, "biller1", "billing")
    assert biller.get("/api/billing/bills").status_code == 200
    assert biller.get("/api/mis/daily").status_code == 200


def test_disabled_user_and_password_change(client):
    user = create(client, "/api/auth/users", username="temp1", role="nurse", password="secret1")
    client.delete(f"/api/auth/users/{user['id']}")
    assert login("temp1", "secret1")[1].status_code == 401
    nurse = as_user(client, "nurse1", "nurse")
    assert nurse.post("/api/auth/password", json={"current": "bad", "new": "newpass"}).status_code == 400
    assert nurse.post("/api/auth/password", json={"current": "secret1", "new": "newpass"}).status_code == 200
    assert login("nurse1", "newpass")[1].status_code == 200


def test_admin_cannot_disable_self(client):
    me = client.get("/api/auth/me").json()["user"]
    assert client.delete(f"/api/auth/users/{me['id']}").status_code == 400
