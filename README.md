# Phundz cash-out demo

A simulation-only cash-out request flow for a dollar-backed wallet. The app only stores requests with `pending` status in PostgreSQL; it has no wallet, blockchain, exchange, M-Pesa, or payment-provider connection, and does not process or pay requests.

## Setup

Requirements: Node.js 20+ and Docker Compose.

1. Copy `.env.example` to `.env` in the repository root.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Apply database migrations with `npm run migrate`.
5. Start both apps with `npm run dev`.

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000`.

The integration test database must be created separately before testing:

```sql
CREATE DATABASE phundz_test;
```

Set `TEST_DATABASE_URL` to that database. API integration tests truncate only `cashout_requests` in this database.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by the API and migration runner | Required |
| `TEST_DATABASE_URL` | Dedicated database for API integration tests | Tests skip when unset |
| `API_PORT` | API listen port | `4000` |
| `WEB_ORIGIN` | Only allowed browser origin for API CORS | `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL used by the browser | `http://localhost:4000` |

## API examples

```sh
curl http://localhost:4000/health

curl -X POST http://localhost:4000/api/cashout-requests \
  -H 'Content-Type: application/json' \
  -d '{"amount":"25.50","phone":"0712345678"}'

curl 'http://localhost:4000/api/cashout-requests?limit=20'
```

POST requests accept decimal-string amounts from `1.00` through `1000.00`, with up to two decimal places, and Kenyan `07`/`01` mobile numbers in supported national or international formats. Phones are stored normalized as E.164. GET returns newest requests first, with a limit from 1 to 100.

Validation errors use `{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "fields": { "amount": "..." } } }`. Unexpected errors return a generic `INTERNAL_ERROR` response without stack or SQL details.

## Development checks

- `npm test` runs shared validation, API, and frontend tests.
- `npm run typecheck` checks all workspace TypeScript projects in strict mode.
- API integration cases run only when `TEST_DATABASE_URL` is set and reachable; unit and frontend tests do not need PostgreSQL.

## Design decisions

- **Fastify:** its built-in `inject()` makes route integration tests direct and avoids opening a network listener.
- **String amounts:** request amounts remain decimal strings and are compared as integer cents with `BigInt`, avoiding binary floating-point money calculations. The API stores PostgreSQL `NUMERIC(18,6)`; accepted cash-out requests intentionally use at most two decimal places because the demo supports practical cent-denominated amounts.
- **Layered API:** routes/controllers handle HTTP, the service owns the use case, and the repository contains parameterized SQL, keeping database behavior replaceable in tests.
- **Shared schema:** the same strict Zod validation and phone normalization run in the browser and API, with the API still authoritative.
- **No payout behavior:** persistence ends at `pending`; there is intentionally no worker or status transition code.

## What I'd do next

Before any real payout workflow: add authentication, idempotency keys, rate limiting, an audit log, and a validated status state machine. A real payout integration should be introduced behind a provider interface with explicit operational and security controls; it is deliberately absent from this simulation.