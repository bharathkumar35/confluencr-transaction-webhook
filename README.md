# Transaction Webhook Service

A Python/FastAPI backend that accepts transaction webhooks quickly, persists them in PostgreSQL, and processes them asynchronously using a database-backed background worker.

## Live Deployment

- **Live API:** https://confluencr-transaction-api.onrender.com
- **Swagger UI:** https://confluencr-transaction-api.onrender.com/docs
- **Health Check:** https://confluencr-transaction-api.onrender.com/

The API and background worker run together in the same Render Web Service. Supabase provides the hosted PostgreSQL database.

## Architecture

- **FastAPI:** Validates and stores each webhook, then immediately returns `202 Accepted`.
- **PostgreSQL:** Provides durable storage and a unique constraint on `transaction_id` for idempotency.
- **Background Worker:** Claims pending transactions, simulates a 30-second processing delay, and marks transactions as `PROCESSED`.
- **Lease Recovery:** Returns abandoned in-progress jobs to the queue after a worker crash.
- **Docker Compose:** Runs the API, PostgreSQL, and worker as separate services locally.
- **Render:** Hosts the API and worker together in one service for the deployed version.
- **Supabase:** Provides managed PostgreSQL storage.

## Requirements

- Docker Desktop / Docker Engine with Compose
- Or Python 3.12+ and PostgreSQL 16+

## Run with Docker

```bash
docker compose up --build
```

Local endpoints:

- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Health: http://localhost:8000/

Stop services:

```bash
docker compose down
```

Database data is stored in the `postgres_data` Docker volume. To remove it too, use:

```bash
docker compose down -v
```

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

Set `DATABASE_URL` to a PostgreSQL database.

Run the API and worker in separate terminals:

Terminal 1:

```bash
uvicorn app.main:app --reload
```

Terminal 2:

```bash
python -m app.worker
```

## API Endpoints

### 1. Health Check

```http
GET /
```

Example response:

```json
{
  "status": "HEALTHY",
  "current_time": "2026-10-31T06:12:12+00:00"
}
```

### 2. Receive Transaction Webhook

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

Response: `202 Accepted` with an empty body.

The API does not wait for the simulated background processing.

### 3. Query Transaction

```http
GET /v1/transactions/txn_abc123def456
```

The response is an array containing the transaction record.

A newly accepted transaction has `PROCESSING` status. After the worker completes the simulated 30-second delay, it becomes `PROCESSED`.

Example:

```json
[
  {
    "transaction_id": "txn_abc123def456",
    "source_account": "acc_user_789",
    "destination_account": "acc_merchant_456",
    "amount": "1500.00",
    "currency": "INR",
    "status": "PROCESSED",
    "created_at": "2026-10-31T06:30:22Z",
    "processed_at": "2026-10-31T06:30:54Z"
  }
]
```

## Test with curl

Submit a webhook:

```bash
curl -i -X POST http://localhost:8000/v1/webhooks/transactions \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"txn_abc123def456","source_account":"acc_user_789","destination_account":"acc_merchant_456","amount":1500,"currency":"INR"}'
```

Immediately query its status:

```bash
curl http://localhost:8000/v1/transactions/txn_abc123def456
```

Submit the exact same webhook again. It returns `202` but does not create a second transaction record or processing job.

Wait approximately 30 seconds and query again:

```bash
curl http://localhost:8000/v1/transactions/txn_abc123def456
```

## Automated Tests

Run:

```bash
docker compose exec api python -m pytest -q
```

The automated test suite covers:

- Health check
- Webhook acceptance
- Duplicate webhook delivery
- Invalid amount validation
- Unknown transaction lookup

**Local test result:** 5 tests passed.

## Live Deployment Verification

The following scenarios were verified against the deployed Render API:

| Test                                                 | Result |
| ---------------------------------------------------- | ------ |
| Health endpoint                                      | Passed |
| Webhook submission returns HTTP 202                  | Passed |
| Transaction persisted in Supabase                    | Passed |
| Background processing after approximately 30 seconds | Passed |
| Transaction status changes to PROCESSED              | Passed |
| Duplicate webhook does not create another record     | Passed |

Example live transaction:

`txn_render_final001`

- First webhook response: `202 Accepted`
- Duplicate webhook response: `202 Accepted`
- Transaction lookup response: `200 OK`
- Final status: `PROCESSED`
- Number of records returned: 1

## Technical Decisions

1. **FastAPI + Pydantic:** Typed request validation and generated OpenAPI/Swagger documentation.
2. **PostgreSQL unique constraint:** Makes idempotency safe when duplicate requests arrive.
3. **Asynchronous worker:** Keeps slow processing out of the request-response path.
4. **Database-backed queue:** Accepted work is persisted before the API acknowledges it.
5. **Row locking with `SKIP LOCKED`:** Allows multiple worker replicas to claim different jobs without processing the same pending row simultaneously on PostgreSQL.
6. **Processing lease:** Abandoned processing records can be recovered after a worker crash.
7. **UTC timestamps:** Timestamps are recorded in UTC for consistent operations.

## Deployment Configuration

### Hosting

- API and worker: Render Web Service
- Database: Supabase PostgreSQL
- Source code: GitHub

### Render Configuration

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
python -m app.worker & uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Both processes use the same deployed application and database configuration.

Required environment variables:

- `DATABASE_URL`
- `PROCESSING_DELAY_SECONDS=30`
- `POLL_INTERVAL_SECONDS=1`
- `PROCESSING_LEASE_SECONDS=120`
- `LOG_LEVEL=INFO`

Keep database credentials in Render environment variables. Never commit secrets to GitHub.

**Deployment note:** The Render Free Web Service may spin down when idle. During that time, background processing pauses until the service wakes up. A dedicated always-on worker is preferable for production workloads.

## Production Hardening

Before integrating with a real payment provider:

- Verify webhook signatures and timestamps to prevent forged or replayed requests.
- Use Alembic migrations instead of `create_all` for schema evolution.
- Add structured logs, metrics, tracing, alerting, and rate limiting.
- Store secrets securely and rotate credentials when necessary.
- Define retry/backoff and a dead-letter policy for external API failures.
- Add authentication and authorization to operational endpoints where appropriate.
- Use managed PostgreSQL with backups and connection pooling.

## Repository Checklist

- [x] Implement FastAPI webhook endpoint.
- [x] Persist transactions in PostgreSQL.
- [x] Implement duplicate transaction prevention.
- [x] Implement asynchronous background processing.
- [x] Implement simulated 30-second processing delay.
- [x] Run automated tests successfully (5 passed).
- [x] Push source code to a public GitHub repository.
- [x] Deploy API and worker to Render.
- [x] Connect deployed application to Supabase PostgreSQL.
- [x] Verify public health endpoint.
- [x] Verify live webhook processing.
- [x] Verify duplicate transaction prevention.
- [ ] Measure live webhook response latency.
- [ ] Review any additional frontend requirements in the assignment guide.

## Project Links

- **GitHub Repository:** https://github.com/bharathkumar35/confluencr-transaction-webhook
- **Live API:** https://confluencr-transaction-api.onrender.com
- **Swagger Documentation:** https://confluencr-transaction-api.onrender.com/docs
