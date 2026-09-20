# revenue-platform

A revenue tracking and reconciliation service for MTN product teams.

Product teams register a service, receive an API key, and post revenue events to
it. The platform records each event once, turns it into balanced double-entry
ledger entries, and reports on the result.

## Stack

NestJS 12 · Prisma 7.10 · PostgreSQL (Supabase) · TypeScript 6 · vitest · oxlint
ESM throughout, Node 24.

## Layout

```
packages/server/          the API
  prisma/schema.prisma    database schema and migrations
  src/prisma/             PrismaService, wired with the pg driver adapter
  src/identity/           register / login / me
  src/services/           services, API keys, roles
  src/events/             revenue event ingest and adjustments
  src/ledger/             accounts, posting rules, double-entry ledger
  src/metrics/            daily aggregates, metrics series, operational health
docs/                     one guide per module - the code carries no comments
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

Built one at a time. The schema gains tables only when the module that needs
them is being written.

| # | Module | Status |
|---|---|---|
| 1 | Database + `User` | done |
| 2 | Identity — register / login / me | done |
| 3 | Service onboarding — `Service`, `ApiKey`, roles | done |
| 4 | Event ingest — `RevenueEvent`, idempotency | done |
| 5 | Posting rules — `Account`, `Entry`, double-entry ledger | done |
| 6 | Adjustments and refunds | done |
| 7 | Aggregates and dashboard | done |
| 8 | Shared data pool, then USSD | next |

## Concepts

The codebase carries no comments — every architectural decision and financial rule
is documented in detail in `docs/`:

- **[Posting Rules & Ledger](docs/06-posting-rules-and-ledger.md)**: Why products report raw facts while the platform decides financial meaning; why rules are immutable dated rows using explicit fractions (handling inclusive Nigerian VAT to the exact kobo); half-up integer math; and why balances are derived rather than stored.
- **[Adjustments & Refunds](docs/07-adjustments-and-refunds.md)**: Why nothing is ever edited or deleted; why refunds are new events linking to the original; row-locking concurrency controls; and why refunds unwind liabilities without modifying past revenue.
- **[Daily Aggregates & Metrics](docs/08-aggregates-and-metrics.md)**: Why the dashboard reads precomputed rollups instead of running heavy aggregations over raw ledger entries; why aggregates are disposable; and why operational health numbers matter as much as revenue numbers.

## API

All routes are under `http://localhost:3003`.

### Identity

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/auth/register` | — | 201 the new user |
| POST | `/auth/login` | — | 200 `{ access_token }` |
| GET | `/auth/me` | Bearer | 200 the current user |

### Services and API keys

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/services` | Bearer | 201 the new service |
| GET | `/services` | Bearer | 200 your services (all of them, if ADMIN) |
| GET | `/services/:id` | Bearer | 200, 404 unknown, 403 not yours |
| DELETE | `/services/:id` | Bearer + ADMIN | 204 |
| POST | `/services/:id/keys` | Bearer | 201 with the full key, shown once |
| GET | `/services/:id/keys` | Bearer | 200 key prefixes only |
| DELETE | `/services/:id/keys/:keyId` | Bearer | 200, key revoked |
| GET | `/services/whoami` | `x-api-key` | 200 the key's service |

### Revenue events

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/events` | `x-api-key` | 202, idempotent on `externalId`, supports `reversesExternalId` |
| GET | `/events` | `x-api-key` | 200 paged events for that service |
| GET | `/events/:id` | `x-api-key` | 200, 404 outside the key's service |
| GET | `/services/:id/events` | Bearer | 200 the human view |
| GET | `/services/:id/events/summary` | Bearer | 200 totals by currency and status |
| GET | `/services/:id/events/:eventId/adjustments` | Bearer | 200 list of reversals, original, reversed and remaining amounts |

### Double-entry ledger

| Method | Route | Auth | Returns |
|---|---|---|---|
| GET | `/accounts` | Bearer | 200 chart of accounts |
| POST | `/services/:id/posting-rules` | Bearer | 201 immutable dated posting rule |
| GET | `/services/:id/posting-rules` | Bearer | 200 rules for service, newest `effectiveFrom` first |
| POST | `/services/:id/events/post` | Bearer | 200/201 `{ posted, failed, skipped }` counts |
| GET | `/services/:id/entries` | Bearer | 200 cursor-paged ledger entries |
| GET | `/services/:id/balances` | Bearer | 200 derived balances per account per currency |

### Daily aggregates & metrics

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/services/:id/aggregates/rebuild` | Bearer | 200/201 `{ days, rows }` recomputed from entries |
| GET | `/services/:id/metrics?from=&to=` | Bearer | 200 daily series per account/currency + totals |
| GET | `/services/:id/health` | Bearer | 200 operational telemetry (lag, counts, refund rate) |
| GET | `/metrics/overview?from=&to=` | Bearer + ADMIN | 200 totals across all services, one row each |

Amounts are integers of the smallest currency unit — `250000` is ₦2,500.00 in
kobo. They are accepted as numbers and returned as strings so no client can turn
one back into a float.
