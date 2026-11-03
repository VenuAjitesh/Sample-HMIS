import os
import tempfile

import pytest

DB_FILE = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def create(client, path, **body):
    response = client.post(path, json=body)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def patient(client):
    return create(client, "/api/patients", name="Test Patient")


@pytest.fixture
def doctor(client):
    return client.get("/api/masters/doctors").json()[0]
