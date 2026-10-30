# Transaction Webhook Service

A Python/FastAPI backend that accepts transaction webhooks quickly, persists them, and processes them asynchronously using a separate database-backed worker.

## Architecture

- **FastAPI** validates and stores each webhook, then returns `202 Accepted`.
- **PostgreSQL** provides durable storage and a unique constraint on `transaction_id` for idempotency.
- **Worker process** claims pending transactions, simulates a 30-second external call, and marks the transaction `PROCESSED`.
- **Lease recovery** returns abandoned in-progress jobs to the queue after a worker crash.
- **Docker Compose** runs the API, PostgreSQL, and worker as separate services.

## Requirements

- Docker Desktop / Docker Engine with Compose
- Or Python 3.12+ and PostgreSQL 16+

## Run with Docker

```bash
docker compose up --build
```

API: http://localhost:8000  
Swagger UI: http://localhost:8000/docs  
Health: http://localhost:8000/

Stop services:

```bash
docker compose down
```

Database data is stored in the `postgres_data` Docker volume. To remove it too, use `docker compose down -v`.

## Run locally without Docker

Create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

Set `DATABASE_URL` to a PostgreSQL database, then run the API and worker in separate terminals:

```bash
uvicorn app.main:app --reload
```

```bash
python -m app.worker
```

## API

### 1. Health check

```http
GET /
```

Example response:

```json
{
  "status": "HEALTHY",
  "current_time": "2026-10-30T10:30:00+00:00"
}
```

### 2. Receive transaction webhook

```http
POST /v1/webhooks/transactions
Content-Type: application/json
```

Request:

```json
{
  "transaction_id": "txn_abc123def456",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500,
  "currency": "INR"
}
```

Response: `202 Accepted` with an empty body. The API does not wait for the simulated processing.

### 3. Query transaction

```http
GET /v1/transactions/txn_abc123def456
```

The response is an array containing the transaction, matching the assessment's example. A newly accepted transaction initially has `PROCESSING` status and `processed_at: null`; after the worker completes the 30-second delay it becomes `PROCESSED`.

## Test with curl

Submit a webhook:

```bash
curl -i -X POST http://localhost:8000/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"txn_abc123def456","source_account":"acc_user_789","destination_account":"acc_merchant_456","amount":1500,"currency":"INR"}'
```

Immediately query status:

```bash
curl http://localhost:8000/v1/transactions/txn_abc123def456
```

Submit the exact same webhook again. It returns `202` but does not create a second transaction or a second processing job.

Wait approximately 30 seconds and query again:

```bash
curl http://localhost:8000/v1/transactions/txn_abc123def456
```

## Run automated tests

```bash
docker compose exec api python -m pytest -q
```

The tests cover health, webhook acceptance, duplicate delivery, invalid amount validation, and unknown transaction IDs.

## Technical decisions

1. **FastAPI + Pydantic:** typed request validation and generated OpenAPI/Swagger documentation.
2. **PostgreSQL unique constraint:** makes idempotency safe even when duplicate requests arrive concurrently. The API treats a duplicate as an accepted delivery.
3. **Separate worker:** keeps slow work out of the request-response path.
4. **Database-backed queue:** accepted work is persisted before the API acknowledges it; a process restart does not erase pending jobs.
5. **Row locking with `SKIP LOCKED`:** allows multiple worker replicas to claim different jobs without processing the same pending row simultaneously on PostgreSQL.
6. **Processing lease:** abandoned processing records can be recovered after a worker crash.
7. **UTC timestamps:** timestamps are recorded in UTC for consistent operations.

## Production hardening before a real payment integration

- Verify the payment provider's webhook signature and timestamp to prevent forged/replayed requests.
- Use Alembic migrations instead of `create_all` for schema evolution.
- Add structured logs, metrics, tracing, alerting, and rate limiting.
- Store secrets in the hosting provider's secret manager; rotate the sample database password.
- Define retry/backoff and a dead-letter policy for real external API failures.
- Add authentication/authorization to operational endpoints where appropriate.
- Use a managed PostgreSQL instance with backups and connection pooling.

## Deployment

Deploy the API and worker as **two separate services** using the same Docker image and the same managed PostgreSQL `DATABASE_URL`:

- API start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Worker start command: `python -m app.worker`

Attach both services to the same persistent managed PostgreSQL database. Do not deploy only the API service: the worker is required to process transactions. Configure `DATABASE_URL` as a secret/environment variable on both services. After deployment, verify `/`, submit a webhook, confirm the initial status, wait 30 seconds, and confirm `PROCESSED`.

## Repository checklist

- [ ] Replace sample credentials and configure production secrets.
- [ ] Run `pytest -q` successfully.
- [ ] Verify duplicate and delayed-processing behavior locally.
- [ ] Push the project to a public GitHub repository.
- [ ] Deploy both API and worker services.
- [ ] Test the public endpoint from outside the hosting platform.
- [ ] Add the public API URL and GitHub repository URL to the assignment submission form.
