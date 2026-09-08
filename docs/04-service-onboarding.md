# 04 — Service onboarding (module 3)

`Service`, `ApiKey` and roles. A product team registers a service and receives a
key; from module 4 onward that key is how their systems post revenue events.

This is the first module with **two kinds of caller**. A human signs in and gets
a JWT. A machine has no browser, no session and nobody to type a password, so it
gets a long-lived API key instead. Both end up on the same routes, so both need a
guard.

## What was added

```
src/services/
  services.controller.ts       all routes, human and machine
  services.service.ts          create / list / get / delete, and the ownership check
  api-keys.service.ts          mint / list / revoke
  api-key.guard.ts             machine auth  (x-api-key header)
  roles.guard.ts               ADMIN / MEMBER
  roles.decorator.ts           @Roles('ADMIN')
  current-service.decorator.ts @CurrentService()
  dto/create-service.dto.ts
  dto/create-api-key.dto.ts
```

Schema: `Role` enum, `role` on `User` (defaults to `MEMBER`), `Service`, `ApiKey`.
`IdentityModule` now exports `AuthGuard` so other modules can reuse it.

## Run it

```bash
cd packages/server
npx prisma migrate dev --name add_service_and_api_key
npx prisma generate
npm run start:dev
```

Existing users all become `MEMBER`. To make yourself an `ADMIN`, open
`npx prisma studio` and change the `role` column on your row, or:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'fewa@mtn.test';
```

Your existing JWT keeps working — the role is read from the database on every
request that needs it, not from the token.

## Routes

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/services` | Bearer | 201, 409 on a duplicate slug |
| GET | `/services` | Bearer | your services; everyone's if you are ADMIN |
| GET | `/services/:id` | Bearer | 404 if unknown, 403 if not yours |
| DELETE | `/services/:id` | Bearer + ADMIN | 204, cascades to its keys |
| POST | `/services/:id/keys` | Bearer | 201, **the only time the full key is shown** |
| GET | `/services/:id/keys` | Bearer | prefixes only, never the secret |
| DELETE | `/services/:id/keys/:keyId` | Bearer | revokes; the row survives |
| GET | `/services/whoami` | `x-api-key` | the machine's `/auth/me` |

## The four decisions worth understanding

### 1 · Why an API key cannot be hashed the way a password is

With a password you know the email. You fetch one row, compare, done. With an
API key the caller hands you an opaque string and nothing else — no handle, no
name, no email. Hash the whole thing and you are comparing against every row in
the table.

So the key carries its own handle:

```
sk_live_<publicId>_<secret>
         ^^^^^^^^   ^^^^^^
         finds      proves
         the row    the row is yours
```

`publicId` is stored in the clear and indexed. `secret` is stored only as a
sha256 hash. Someone who steals the database gets a list of `publicId`s, which
open nothing.

### 2 · sha256 here, bcrypt there

bcrypt is deliberately slow. That is the whole point of it: passwords are short
and human-chosen, so making each guess cost 100ms is what makes guessing them
impractical.

An API key secret is 32 random bytes. Nobody is guessing it in any number of
years, so slowness buys nothing — and this hash runs on every single event MTN
posts. sha256 is the right tool: fast, and still one-way.

The rule underneath: **slow hashing is for low-entropy secrets. Fast hashing is
for high-entropy ones.**

### 3 · Why `timingSafeEqual` instead of `===`

`===` on two buffers stops at the first byte that differs. That means a
comparison failing on byte 1 returns faster than one failing on byte 30 — and
that difference is measurable over enough requests. An attacker can use it to
recover a secret one byte at a time. `timingSafeEqual` always reads the whole
buffer, so every wrong answer costs the same.

### 4 · Revoke, don't delete

`DELETE /services/:id/keys/:keyId` sets `revokedAt`. The row stays. A deleted key
leaves no record of what it did or when it stopped; a revoked one stops working
immediately and stays in the audit trail — which matters once these keys are
posting money.

## Guards vs. filters

A guard can only answer yes or no, so it cannot narrow a list. That is why
`GET /services` does its ADMIN/MEMBER split inside `ServicesService.findAllFor`
rather than in `RolesGuard`, while `DELETE /services/:id` — a plain yes-or-no —
uses the guard.

`assertCanAccess` is the one place that answers "may this user touch this
service?". Every route calls it, so no route can forget to.

## Checks

Import `postman/collections/revenue-platform-services.postman_collection.json`
and hit **Run**. In order it: logs in, creates a service, rejects a duplicate
slug, mints a key, calls `/services/whoami` with it, confirms the key list never
contains the secret, revokes the key, and confirms the revoked key now returns
401.

Two things the runner cannot do for you:

- **403 on someone else's service.** Register a second user, log in as them, and
  `GET /services/:id` with the first user's service id.
- **ADMIN.** `DELETE /services/:id` returns 403 until you set your role to
  `ADMIN` in the database, then 204.

## Done when

- [ ] `POST /services/:id/keys` shows the full key once and never again
- [ ] `GET /services/:id/keys` contains no secret, only `sk_live_<publicId>`
- [ ] `/services/whoami` returns the right service for its key
- [ ] A revoked key returns 401
- [ ] Another user's service returns 403, an unknown id returns 404
- [ ] `DELETE /services/:id` is 403 as MEMBER, 204 as ADMIN

Next module: event ingest — `RevenueEvent`, idempotency on
`(serviceId, externalId)`, and `POST /events` authenticated by the key you just
minted.
