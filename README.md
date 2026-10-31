# Transaction Webhook Service

A full-stack transaction webhook processing system built with **FastAPI, PostgreSQL, SQLAlchemy, Docker, and React**.

The application accepts transaction webhooks, stores transactions in PostgreSQL, and processes them asynchronously using a background worker.

## Live Application

- **Frontend Dashboard:** https://charming-croissant-81754d.netlify.app/
- **Live API:** https://confluencr-transaction-api.onrender.com/
- **Swagger API Documentation:** https://confluencr-transaction-api.onrender.com/docs
- **Health Check:** https://confluencr-transaction-api.onrender.com/

The React frontend is deployed on Netlify. The FastAPI backend and background worker run together on Render, with Supabase PostgreSQL providing persistent storage.

**Note:** The Render free service may sleep after inactivity. The first request after inactivity can take longer while the service wakes up. The worker also pauses while the service is sleeping.

## Technology Stack

### Backend

- Python 3.12+
- FastAPI
- SQLAlchemy
- Pydantic
- PostgreSQL
- Pytest

### Frontend

- React
- Vite
- JavaScript
- CSS

### Infrastructure

- Docker
- Docker Compose
- Supabase PostgreSQL
- Render
- Netlify

## Key Features

- Accepts transaction webhook requests through a REST API.
- Returns HTTP `202 Accepted` immediately after accepting a valid transaction.
- Processes transactions asynchronously using a background worker.
- Simulates a 30-second transaction processing delay.
- Prevents duplicate transaction processing using a unique transaction ID.
- Stores transaction records persistently in PostgreSQL.
- Provides transaction status and transaction history APIs.
- Includes a React dashboard to monitor transaction activity.
- Supports transaction history, status filtering, and transaction submission.
- Includes automated API tests using Pytest.

## Application Architecture

1. The client submits a transaction webhook.
2. FastAPI validates the incoming request.
3. The transaction is saved in PostgreSQL with a pending status.
4. The API immediately returns `202 Accepted`.
5. The background worker retrieves pending transactions.
6. The worker simulates the processing delay and updates the transaction status.
7. The frontend retrieves and displays transaction information.

## API Endpoints

| Method | Endpoint                            | Description                     |
| ------ | ----------------------------------- | ------------------------------- |
| GET    | `/`                                 | Health check                    |
| POST   | `/v1/webhooks/transactions`         | Submit a transaction webhook    |
| GET    | `/v1/transactions`                  | Retrieve all transactions       |
| GET    | `/v1/transactions/{transaction_id}` | Retrieve a specific transaction |

### Example Webhook Request

**POST** `/v1/webhooks/transactions`

```json
{
  "transaction_id": "txn_example001",
  "source_account": "acc_user_789",
  "destination_account": "acc_merchant_456",
  "amount": 1500.0,
  "currency": "INR"
}
```

### Example Response

```json
{
  "message": "Transaction accepted",
  "transaction_id": "txn_example001",
  "status": "PROCESSING"
}
```

The transaction is accepted immediately and processed asynchronously.

## Transaction Status

| Status     | Description                                      |
| ---------- | ------------------------------------------------ |
| PROCESSING | Transaction is awaiting or undergoing processing |
| PROCESSED  | Transaction processing completed successfully    |

## Local Setup

### Prerequisites

- Python 3.12+
- Docker Desktop
- Node.js 18+
- Git

### 1. Clone the repository

```bash
git clone https://github.com/bharathkumar35/confluencr-transaction-webhook.git
cd confluencr-transaction-webhook
```

### 2. Configure environment variables

Create a `.env` file using `.env.example` as a reference.

Configure the database connection and other required environment variables.

Do not commit database passwords or other secrets to GitHub.

### 3. Start the backend services

From the project root directory, run:

```bash
docker compose up --build
```

This starts the API, PostgreSQL database, and background worker.

### 4. Access the backend

- API: http://localhost:8000
- Swagger documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/

### 5. Start the frontend

Open another terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at:

http://localhost:5173/

By default, the frontend connects to the local backend at `http://localhost:8000`. The API URL can be configured using the `VITE_API_BASE_URL` environment variable.

## Running Tests

Run the backend tests inside the API container:

```bash
docker compose exec api python -m pytest -v
```

**Latest local test result:**

```text
6 passed, 1 warning
```

The tests cover:

- Health check
- Transaction webhook submission
- Duplicate transaction handling
- Invalid transaction validation
- Unknown transaction lookup
- Retrieving transaction history

## Performance Verification

A warmed live API webhook request was measured at approximately **434.94 ms** in one local measurement session.

This was a single observed request, not a guaranteed response time for every request. Render cold starts can take longer.

The transaction processing delay was also verified at approximately 30 seconds.

## Deployment Notes

### Frontend

The React dashboard is deployed on Netlify.

https://charming-croissant-81754d.netlify.app/

### Backend

The FastAPI backend and background worker are deployed together on Render.

- API: https://confluencr-transaction-api.onrender.com/
- API Documentation: https://confluencr-transaction-api.onrender.com/docs

### Database

Supabase PostgreSQL provides persistent transaction storage.

### Deployment Considerations

- Netlify hosts the React frontend.
- Render hosts the FastAPI backend and background worker in one web service.
- Supabase provides PostgreSQL database storage.
- The Render free service may sleep after inactivity, increasing cold-start response times.
- The background worker pauses when the Render service sleeps.

## Project Repository

GitHub: https://github.com/bharathkumar35/confluencr-transaction-webhook

## Project Status

- [x] Backend API implementation
- [x] PostgreSQL integration
- [x] Background transaction processing
- [x] Duplicate transaction protection
- [x] Docker configuration
- [x] Automated backend tests
- [x] Backend cloud deployment
- [x] Live transaction processing verification
- [x] React dashboard implementation
- [x] Frontend integration with backend
- [x] Transaction history retrieval
- [x] Processed transaction value calculation
- [x] Frontend production deployment
- [x] Public frontend access
- [x] Production frontend-to-backend integration
- [x] GitHub repository updated
