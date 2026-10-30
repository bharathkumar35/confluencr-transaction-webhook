import logging
import os
import time
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from .database import Base, SessionLocal, engine
from .models import Transaction

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("transaction-worker")
PROCESSING_DELAY_SECONDS = int(os.getenv("PROCESSING_DELAY_SECONDS", "30"))
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "1"))
LEASE_SECONDS = int(os.getenv("PROCESSING_LEASE_SECONDS", "120"))

def recover_abandoned_jobs(db):
    """Return jobs abandoned by a worker crash to the pending queue."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=LEASE_SECONDS)
    stale = db.scalars(
        select(Transaction).where(
            Transaction.status == "PROCESSING",
            Transaction.processing_started_at.is_not(None),
            Transaction.processing_started_at < cutoff,
        )
    ).all()
    for item in stale:
        item.status = "PENDING"
        item.processing_started_at = None
        item.last_error = "Recovered after processing lease expired"
    if stale:
        db.commit()
        logger.warning("Recovered %s abandoned transaction(s)", len(stale))

def claim_one(db):
    """Atomically claim one pending job; SKIP LOCKED supports multiple workers."""
    item = db.scalar(
        select(Transaction)
        .where(Transaction.status == "PENDING")
        .order_by(Transaction.created_at, Transaction.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if item is None:
        return None
    item.status = "PROCESSING"
    item.processing_started_at = datetime.now(timezone.utc)
    item.attempts += 1
    db.commit()
    db.refresh(item)
    return item.id

def process_one(transaction_pk: int):
    logger.info("Processing transaction row %s", transaction_pk)
    time.sleep(PROCESSING_DELAY_SECONDS)  # Simulates a slow external payment-provider call.
    with SessionLocal() as db:
        item = db.get(Transaction, transaction_pk)
        if item is None or item.status != "PROCESSING":
            return
        item.status = "PROCESSED"
        item.processed_at = datetime.now(timezone.utc)
        item.processing_started_at = None
        item.last_error = None
        db.commit()
    logger.info("Transaction row %s processed", transaction_pk)

def run():
    Base.metadata.create_all(bind=engine)
    logger.info("Worker started; simulated delay=%ss", PROCESSING_DELAY_SECONDS)
    while True:
        try:
            with SessionLocal() as db:
                recover_abandoned_jobs(db)
                transaction_pk = claim_one(db)
            if transaction_pk is None:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            process_one(transaction_pk)
        except Exception:
            logger.exception("Worker iteration failed")
            time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    run()
