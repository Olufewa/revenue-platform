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
docs/                     one guide per module
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

The API listens on the `PORT` set in `.env`, defaulting to 3003.
See `docs/03-run-and-verify.md` for the full check list.

## Modules

| # | Module | Status |
|---|---|---|
| 1 | Database + `User` | done |
| 2 | Identity — register / login | done |
| 3 | Service onboarding — `Service`, `ApiKey`, roles | done |
| 4 | Money, accounts, orders, ledger transactions | done |
| 5 | Balances and revenue report | done |

## Concepts

The code keeps comments to the non-obvious; the reasoning lives in `docs/`:

- **[Service onboarding](docs/04-service-onboarding.md)**: humans use JWTs and machines use API keys, why keys are hashed with SHA-256, and why `lastUsedAt` is written coarsely.
- **[Orders & ledger](docs/05-orders-and-ledger.md)**: Money in minor units, Fowler allocation, exchange rates as exact fractions, why a transaction must balance exactly, how base amounts stay balanced across currencies, and why corrections are reversals rather than edits.

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
| POST | `/services` | Bearer | 201 the new service; body `{ name, baseCurrency }` |
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

### Orders and transactions

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/orders` | `x-api-key` | 201 `{ duplicate, order }`, idempotent on `externalId` |
| GET | `/orders` | `x-api-key` | 200 cursor-paged orders |
| GET | `/orders/:id` | `x-api-key` | 200, 404 outside the key's service |
| POST | `/orders/:orderId/transactions` | `x-api-key` | 201 `{ duplicate, transaction }`; 400 unless balanced |
| GET | `/orders/:orderId/transactions` | `x-api-key` | 200 the order's transactions |
| GET | `/transactions/:id` | `x-api-key` | 200 with entries |
| POST | `/transactions/:id/reverse` | `x-api-key` | 201 the mirror transaction; 409 if already reversed |
| GET | `/services/:id/orders` | Bearer | 200 the human view |
| GET | `/services/:id/orders/:orderId` | Bearer | 200 |
| GET | `/services/:id/orders/:orderId/transactions` | Bearer | 200 |
| GET | `/services/:id/transactions/:txnId` | Bearer | 200 |

### Reports

| Method | Route | Auth | Returns |
|---|---|---|---|
| GET | `/services/:id/balances?asOf=` | Bearer | 200 trial balance in base currency |
| GET | `/services/:id/reports/revenue?from=&to=` | Bearer | 200 net income per day in base currency |

Amounts are integers of the smallest currency unit — `250000` is ₦2,500.00 in
kobo. They are accepted as numbers and returned as Money,
`{ "amount": "250000", "currency": "NGN" }`, with the amount as a string so no
client can turn it back into a float.
