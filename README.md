# Phundz cash-out request demo

A **simulation-only** cash-out request flow for Phundz, a dollar-backed wallet with local cash-out.

> Nothing in this repo moves money. There is no wallet, blockchain, exchange, M-Pesa/Daraja, or
> payment-provider integration. Requests are saved to PostgreSQL with status `pending`, and nothing
> ever processes or pays them out.

## Layout

```
.
├── apps/
│   ├── api/                      Fastify API
│   │   ├── migrations/           Plain .sql files, applied in filename order
│   │   ├── src/
│   │   │   ├── app.ts            Builds the Fastify app (no listen) for tests
│   │   │   ├── server.ts         Loads config, creates pool, listen()
│   │   │   ├── migrate.ts        `npm run migrate` CLI
│   │   │   ├── config/env.ts     Env loading + validation (fail fast)
│   │   │   ├── routes/           URL -> controller wiring
│   │   │   ├── controllers/      HTTP in/out, request validation
│   │   │   ├── services/         Use cases
│   │   │   ├── repositories/     Parameterized SQL, row -> DTO mapping
│   │   │   ├── db/               Query executor type, migration runner
│   │   │   └── errors/           AppError + centralized error handler
│   │   └── tests/                Integration tests (real Postgres)
│   └── web/                      Next.js App Router frontend
│       ├── app/                  page.tsx, components/, CSS modules
│       ├── lib/                  Typed API client, format helpers, data hook
│       └── tests/                React Testing Library + unit tests
├── packages/shared/              Zod schemas, money/phone helpers, shared types
├── docker/postgres-init/         Creates the phundz_test database
├── docker-compose.yml
└── .env.example
```

## Setup

Requirements: Node.js 20+, npm 10+, Docker.

```sh
cp .env.example .env
docker compose up -d        # Postgres 16 with databases phundz and phundz_test
npm install
npm run migrate             # applies migrations to DATABASE_URL
npm run migrate:test        # applies migrations to TEST_DATABASE_URL (optional; tests also do this)
npm run dev                 # API on :4000, web on :3000
```

Open http://localhost:3000.

> The test database is created by `docker/postgres-init` only on the **first** start of an empty
> volume. If your volume predates that, run
> `docker compose exec postgres createdb -U phundz phundz_test`.

## Environment variables

All variables live in the repo-root `.env`.

| Variable | Used by | Purpose | Default |
| --- | --- | --- | --- |
| `DATABASE_URL` | API, `migrate` | PostgreSQL connection string | **required** |
| `API_PORT` | API | Listen port | `4000` |
| `WEB_ORIGIN` | API | The only origin allowed by CORS | `http://localhost:3000` |
| `TEST_DATABASE_URL` | tests, `migrate:test` | Separate DB for integration tests; must differ from `DATABASE_URL` | integration tests skip if unset |
| `NEXT_PUBLIC_API_BASE_URL` | web | API base URL used by the browser | `http://localhost:4000` |

The API validates its env at startup and exits with a message naming the bad variable.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | `{ "status": "ok" }` |
| `POST` | `/api/cashout-requests` | Validate and save a request as `pending`. Returns `201` and the row. |
| `GET` | `/api/cashout-requests?limit=50` | Newest first. `limit` 1 to 100, default 50. |

```sh
curl http://localhost:4000/health

curl -i -X POST http://localhost:4000/api/cashout-requests \
  -H 'Content-Type: application/json' \
  -d '{"amount":"25.50","phone":"0712 345 678"}'
# 201
# {"id":"2268a339-…","amountUsdc":"25.500000","phoneNumber":"+254712345678",
#  "status":"pending","createdAt":"2026-10-01T11:45:42.109Z","updatedAt":"…"}

curl -i -X POST http://localhost:4000/api/cashout-requests \
  -H 'Content-Type: application/json' \
  -d '{"amount":"0.5","phone":"0812345678","note":"hi"}'
# 400
# {"error":{"code":"VALIDATION_ERROR","message":"Request validation failed",
#   "fields":{"amount":"Minimum cash-out is 1.00 USDC",
#             "phone":"Enter a valid Kenyan M-Pesa number","note":"Unknown field"}}}

curl 'http://localhost:4000/api/cashout-requests?limit=20'
```

Every error has the same shape: `{ "error": { "code", "message", "fields"? } }`.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body or query failed the shared schema (`fields` included) |
| 400 | `BAD_REQUEST` | Malformed JSON or another framework-level client error |
| 404 | `NOT_FOUND` | Unknown route |
| 500 | `INTERNAL_ERROR` | Anything unexpected. Logged server-side; no stack or SQL in the response. |

### Validation rules

- **amount**: a decimal **string** from `1.00` to `1000.00`, at most 2 decimal places.
  Normalized to e.g. `"25.50"`, stored as `NUMERIC(18,6)`.
- **phone**: `07XXXXXXXX`, `01XXXXXXXX`, `2547…`/`2541…`, or `+2547…`/`+2541…`. Surrounding
  whitespace and inner spaces/dashes are allowed. Stored as E.164 (`+254XXXXXXXXX`).
- Unknown fields are rejected.

## Tests

```sh
npm test            # all Vitest suites
npm run typecheck   # tsc --noEmit across all workspaces (strict)
```

- **Shared**: amount and phone rules, normalization, field-error mapping, the limit query.
- **API integration**: built with `createApp()` and driven by `inject()` against the real
  `TEST_DATABASE_URL` database. Migrations run in `beforeAll`, and the table is truncated before
  each test. The suite refuses to run if the test DB name equals the app DB name, and skips (with a
  warning) if `TEST_DATABASE_URL` is unset.
- **Web**: React Testing Library tests for inline errors, the review step, submit + list refresh,
  server field errors, and the list error state.

## Design decisions

- **Fastify over Express:** built-in `inject()` gives fast, listener-free integration tests, and
  its native async error handling makes one central error handler straightforward.
- **Amounts as strings:** JSON numbers become IEEE-754 floats in JS, and `0.1 + 0.2 !== 0.3`.
  Amounts stay decimal strings end to end. Range checks compare **BigInt cents**, Postgres stores
  `NUMERIC(18,6)`, and the API reads it back with `amount_usdc::text`, so a value never passes
  through a JS `number`. USDC has 6 decimals, but cash-outs are paid in practical currency units,
  so requests allow 2 decimals; the column keeps full USDC precision.
- **Layered API (routes → controller → service → repository):** HTTP concerns, use cases, and
  SQL each have one home. The repository is the only code that knows table and column names, and
  the service is where business rules (state machine, idempotency) would go next. `createApp()`
  takes its DB as a dependency, which is how the 500-path test injects a failing one.
- **Shared schema package:** the browser and API run the *same* zod schema, so client-side
  errors and server-side `fields` match. The API remains authoritative. Types such as
  `CashoutRequestRecord` are shared too, so the client and server agree on the response shape.
- **Hand-rolled migrations:** plain SQL files plus a `schema_migrations` table, with each file
  and its bookkeeping row in one transaction. Enough for this scope, with no framework to learn.

## What I'd do next

- **Auth:** tie requests to an authenticated wallet owner; list only the caller's requests.
- **Idempotency keys:** an `Idempotency-Key` header with a unique constraint, so a retried
  submit never creates a duplicate cash-out.
- **Rate limiting:** per user and per IP on `POST` (e.g. `@fastify/rate-limit`), plus per-day
  amount limits.
- **Audit log:** append-only `cashout_request_events` (who, what, when, old → new status).
- **Status state machine:** allow only `pending → processing → completed|failed`, enforce it
  in the service and with a DB check or trigger, and update `updated_at` on transitions.
- **Real payouts behind a provider interface:** a `PayoutProvider` interface
  (`initiate`, `getStatus`, webhook verification) implemented by an M-Pesa B2C adapter, driven
  by a worker/outbox rather than the request path. Also FX quoting/locking for USDC → KES, and
  reconciliation.
- Pagination cursors for history, structured logging with request IDs, OpenAPI docs, CI.
