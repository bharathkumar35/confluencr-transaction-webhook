from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import Transaction
from .schemas import TransactionResponse, WebhookRequest


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Transaction Webhook Service",
    description=(
        "An asynchronous, idempotent webhook API. Incoming transactions are "
        "persisted immediately and processed by a separate durable worker."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "HEALTHY", "current_time": datetime.now(timezone.utc).isoformat()}


@app.post(
    "/v1/webhooks/transactions",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Webhooks"],
    summary="Accept a transaction webhook",
)
def receive_transaction(payload: WebhookRequest, db: Session = Depends(get_db)):
    # PENDING is an internal queue state; the public API reports it as PROCESSING.
    # The unique database constraint is the final guard against concurrent duplicates.
    transaction = Transaction(
        transaction_id=payload.transaction_id,
        source_account=payload.source_account,
        destination_account=payload.destination_account,
        amount=payload.amount,
        currency=payload.currency,
        status="PENDING",
    )
    db.add(transaction)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # A duplicate is an idempotent success: do not create another queue item.
    return Response(status_code=status.HTTP_202_ACCEPTED)


@app.get(
    "/v1/transactions",
    response_model=list[TransactionResponse],
    tags=["Transactions"],
    summary="Get all transactions",
)
def get_all_transactions(db: Session = Depends(get_db)):
    transactions = db.scalars(
        select(Transaction).order_by(Transaction.created_at.desc())
    ).all()

    return [
        {
            "transaction_id": transaction.transaction_id,
            "source_account": transaction.source_account,
            "destination_account": transaction.destination_account,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "status": (
                "PROCESSING"
                if transaction.status == "PENDING"
                else transaction.status
            ),
            "created_at": transaction.created_at,
            "processed_at": transaction.processed_at,
        }
        for transaction in transactions
    ]


@app.get(
    "/v1/transactions/{transaction_id}",
    response_model=list[TransactionResponse],
    tags=["Transactions"],
    summary="Get transaction status",
)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    transaction = db.scalar(
        select(Transaction).where(Transaction.transaction_id == transaction_id)
    )
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Keep the assessment's public status contract while using PENDING internally.
    public_status = "PROCESSING" if transaction.status == "PENDING" else transaction.status
    return [{
        "transaction_id": transaction.transaction_id,
        "source_account": transaction.source_account,
        "destination_account": transaction.destination_account,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "status": public_status,
        "created_at": transaction.created_at,
        "processed_at": transaction.processed_at,
    }]
