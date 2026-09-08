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
docs/                     one guide per module
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

See `docs/03-run-and-verify.md` for the full check list.

## Modules

Built one at a time. The schema gains tables only when the module that needs
them is being written.

| # | Module | Status |
|---|---|---|
| 1 | Database + `User` | done |
| 2 | Identity — register / login / me | done |
| 3 | Service onboarding — `Service`, `ApiKey`, roles | next |
| 4 | Event ingest — `RevenueEvent`, idempotency | |
| 5 | Posting rules — `Account`, `Entry`, double-entry ledger | |
| 6 | Adjustments and refunds | |
| 7 | Aggregates and dashboard | |
| 8 | Shared data pool, then USSD | |

## API

All routes are under `http://localhost:3000`.

### Identity

| Method | Route | Auth | Returns |
|---|---|---|---|
| POST | `/auth/register` | — | 201 the new user |
| POST | `/auth/login` | — | 200 `{ access_token }` |
| GET | `/auth/me` | Bearer | 200 the current user |
