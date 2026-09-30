# revenue-platform

A revenue tracking and reconciliation service for MTN product teams.

Product teams register a service with a base currency and receive an API key.
Their systems send each **order**, then the **ledger transaction** that records
it. The platform checks that every transaction balances, stores it
immutably, and reports balances and revenue in the base currency. The model
follows Martin Fowler's Money, Account and Accounting Transaction patterns.

## Stack

NestJS 12 · Prisma 7.10 · PostgreSQL (Supabase) · TypeScript 6 · vitest · oxlint
ESM throughout, Node 24.

## Layout

```
packages/server/          the API
  prisma/schema.prisma    database schema and migrations
  src/prisma/             PrismaService, wired with the pg driver adapter
  src/money/              Money, Currency, ExchangeRate (pure, no framework)
  src/identity/           register / login
  src/services/           services, base currency, API keys, roles
  src/accounts/           per-service chart of accounts
  src/orders/             order intake, idempotent on externalId
  src/ledger/             balanced accounting transactions and reversals
  src/reports/            trial balance and revenue report
docs/                     user flow guide
postman/                  importable request collection with assertions
```

## Getting started

```bash
cd packages/server
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

The API listens on the `PORT` set in `.env`, defaulting to 3003. Interactive
API docs are at `/docs` (raw OpenAPI at `/docs-json`).
See `docs/user-flow.md` for the end-to-end flow.

### Tests

```bash
npm test            # unit + controller specs, no database
npm run test:e2e    # full flow against real Postgres
```

`test:e2e` creates a throwaway database on the server in `TEST_DATABASE_URL`
(default: `DATABASE_URL`'s server), applies every migration to it, runs the
Postman flow through the real app, and drops it again. Your dev database is
never touched. The user needs `CREATEDB`.

## Modules

| # | Module | Status |
|---|---|---|
| 1 | Database + `User` | done |
| 2 | Identity — register / login | done |
| 3 | Service onboarding — `Service`, `ApiKey`, roles | done |
| 4 | Money, accounts, orders, ledger transactions | done |
| 5 | Balances and revenue report | done |

## Concepts

The code keeps comments to the non-obvious. For how a product team uses the
platform, from sign-up to reports with example requests, see
**[docs/user-flow.md](docs/user-flow.md)**.

## API

All routes are under `http://localhost:3003`.

### Identity

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/auth/register` | — | 201 the new user |
| POST | `/auth/login` | — | 200 `{ access_token }` |

### Services and API keys

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/services` | Bearer | 201 the new service; body `{ name, baseCurrency, timezone? }` |
| GET | `/services` | Bearer | 200 your services (all of them, if ADMIN) |
| GET | `/services/:id` | Bearer | 200, 404 unknown, 403 not yours |
| DELETE | `/services/:id` | Bearer + ADMIN | 204 |
| POST | `/services/:id/keys` | Bearer | 201 with the full key, shown once |
| GET | `/services/:id/keys` | Bearer | 200 key prefixes only |
| DELETE | `/services/:id/keys/:keyId` | Bearer | 200, key revoked |
| GET | `/services/whoami` | `x-api-key` | 200 the key's service |

### Accounts

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/services/:id/accounts` | Bearer | 201; 409 on a duplicate code |
| GET | `/services/:id/accounts` | Bearer | 200 the chart of accounts |
| PATCH | `/services/:id/accounts/:code` | Bearer | 200; `{ name?, archived? }` |

### Orders and transactions

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/orders` | `x-api-key` | 201 `{ duplicate, order }`, idempotent on `externalId` |
| GET | `/orders` | `x-api-key` | 200 cursor-paged orders |
| GET | `/orders/:id` | `x-api-key` | 200, 404 outside the key's service |
| POST | `/orders/:orderId/transactions` | `x-api-key` | 201 `{ duplicate, transaction }`; 400 unless balanced |
| POST | `/transactions` | `x-api-key` | 201; optional `orderId`, for fees and settlements |
| GET | `/transactions` | `x-api-key` | 200 cursor-paged transactions |
| GET | `/orders/:orderId/transactions` | `x-api-key` | 200 the order's transactions |
| GET | `/orders/:orderId/summary` | `x-api-key` | 200 income recognised vs. order total |
| GET | `/transactions/:id` | `x-api-key` | 200 with entries |
| POST | `/transactions/:id/reverse` | `x-api-key` | 201 the mirror transaction; 409 if already reversed |
| GET | `/services/:id/orders` | Bearer | 200 the human view |
| GET | `/services/:id/orders/:orderId` | Bearer | 200 |
| GET | `/services/:id/orders/:orderId/transactions` | Bearer | 200 |
| GET | `/services/:id/orders/:orderId/summary` | Bearer | 200 |
| GET | `/services/:id/transactions` | Bearer | 200 cursor-paged |
| GET | `/services/:id/transactions/:txnId` | Bearer | 200 |

### Reports

| Method | Route | Auth | Returns |
|---|---|---|---|
| GET | `/services/:id/balances?asOf=` | Bearer | 200 trial balance in base currency |
| GET | `/services/:id/reports/revenue?from=&to=` | Bearer | 200 net income per local day (service timezone), base currency |

Resending an order or transaction with the same `externalId` and the same
body returns the original (`duplicate: true`). The same `externalId` with a
different body is a **422**.

Amounts are integers of the smallest currency unit — `250000` is ₦2,500.00 in
kobo. They are accepted as numbers and returned as Money,
`{ "amount": "250000", "currency": "NGN" }`, with the amount as a string so no
client can turn it back into a float.
