from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

from app.database import Base, get_db
from app.main import app

@pytest.fixture()
def client():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)

PAYLOAD = {
    "transaction_id": "txn_abc123def456",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": 1500,
    "currency": "INR",
}

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"
    assert "current_time" in response.json()

def test_accepts_webhook_and_returns_202(client):
    response = client.post("/v1/webhooks/transactions", json=PAYLOAD)
    assert response.status_code == 202

def test_duplicate_webhook_is_idempotent(client):
    first = client.post("/v1/webhooks/transactions", json=PAYLOAD)
    second = client.post("/v1/webhooks/transactions", json=PAYLOAD)
    assert first.status_code == second.status_code == 202
    result = client.get(f"/v1/transactions/{PAYLOAD['transaction_id']}")
    assert result.status_code == 200
    assert len(result.json()) == 1
    assert result.json()[0]["status"] == "PROCESSING"
    assert result.json()[0]["processed_at"] is None

def test_validation_rejects_invalid_amount(client):
    invalid = {**PAYLOAD, "amount": -1}
    response = client.post("/v1/webhooks/transactions", json=invalid)
    assert response.status_code == 422

def test_unknown_transaction_returns_404(client):
    response = client.get("/v1/transactions/not-found")
    assert response.status_code == 404
