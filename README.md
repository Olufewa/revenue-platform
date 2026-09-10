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
  src/events/             revenue event ingest
docs/                     one guide per module - the code carries no comments
postman/collections/      importable request collection with assertions
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
| 5 | Posting rules — `Account`, `Entry`, double-entry ledger | next |
| 6 | Adjustments and refunds | |
| 7 | Aggregates and dashboard | |
| 8 | Shared data pool, then USSD | |

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
| POST | `/events` | `x-api-key` | 202, idempotent on `externalId` |
| GET | `/events` | `x-api-key` | 200 paged events for that service |
| GET | `/events/:id` | `x-api-key` | 200, 404 outside the key's service |
| GET | `/services/:id/events` | Bearer | 200 the human view |
| GET | `/services/:id/events/summary` | Bearer | 200 totals by currency and status |

Amounts are integers of the smallest currency unit — `250000` is ₦2,500.00 in
kobo. They are accepted as numbers and returned as strings so no client can turn
one back into a float.
