# 05 — Event ingest (module 4)

`RevenueEvent`. A product team's systems post revenue events with the API key
they were given in module 3. This is the first module where money enters the
platform, and the first one written for machines rather than people.

The code under `src/` carries no comments — the reasoning lives here.

## Run it

```bash
cd packages/server
npx prisma migrate dev --name add_revenue_event
npx prisma generate
npm run start:dev
```

## Routes

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/events` | `x-api-key` | **202**, idempotent on `externalId` |
| GET | `/events` | `x-api-key` | this key's service only, paged |
| GET | `/events/:id` | `x-api-key` | 404 if it belongs to another service |
| GET | `/services/:id/events` | Bearer | the human view of the same data |
| GET | `/services/:id/events/summary` | Bearer | totals by currency and status |

A request body looks like this:

```json
{
  "externalId": "airtime-2026-09-08-000123",
  "type": "airtime.purchase",
  "amountMinor": 250000,
  "currency": "NGN",
  "occurredAt": "2026-09-08T14:32:00.000Z",
  "metadata": { "channel": "ussd", "msisdn_hash": "a91f..." }
}
```

## The five decisions worth understanding

### 1 · Money is an integer, always

`amountMinor` is 250000 — that is ₦2,500.00 expressed in kobo. Never 2500.00.

`0.1 + 0.2` in JavaScript is `0.30000000000000004`. Floating point cannot
represent most decimal fractions exactly, so every arithmetic step on a float
loses a little. One rounding error is invisible; a million of them across a
reconciliation report is a number nobody can explain. Integers of the smallest
unit have no fractional part to lose, so the arithmetic is exact.

The DTO uses `@IsInt()`, so `250000.5` is rejected at the door with a 400. The
column is `BigInt`, because a busy service can exceed the ~2.1 billion an `Int`
holds.

The cost of `BigInt` is that `JSON.stringify` refuses to serialise it. Two things
handle that: `publicEvent()` converts it to a string on the way out, and
`main.ts` defines `BigInt.prototype.toJSON` as a safety net for anything that
slips past the mapper. Amounts therefore arrive as numbers and leave as strings —
deliberately, so no client can quietly turn one back into a float.

### 2 · Idempotency is a database constraint, not an `if`

Networks retry. A timeout does not tell the sender whether the request was lost
on the way there or on the way back, so a well-behaved client sends it again. If
that produced a second row, MTN's revenue would be overstated by every retry in
the system.

So the client supplies an `externalId` — their own id for the transaction — and
the schema carries:

```prisma
@@unique([serviceId, externalId])
```

Scoped to the service, so two teams can both use `invoice-1` without colliding.

`ingest()` looks the event up first and returns it if found. That check is a fast
path, **not the guarantee**. Two retries arriving at the same moment both see
nothing, both call `create`, and one of them loses — Postgres rejects it with
`P2002`, unique-constraint violation. Catching `P2002` and returning the row that
won is what makes the operation genuinely idempotent.

The rule underneath: **a check you perform is a race; a constraint the database
enforces is a guarantee.** Write both — the check for the common case, the catch
for the truth.

The response says which happened:

```json
{ "duplicate": true, "event": { ... } }
```

Either way the status is 202 and the client can stop retrying.

### 3 · Why 202 Accepted rather than 201 Created

201 says "the thing you asked for now exists, finished." That is not true here.
The event has been *recorded*, but it has not been turned into ledger entries —
that is module 5. `status` starts at `PENDING` and becomes `POSTED` once the
ledger has it.

202 is the honest answer: accepted, durable, not yet fully processed. It also
means the queue can be added later without changing the contract clients already
depend on.

### 4 · Store raw, interpret later

Nothing in this module decides what an event *means*. No account is chosen, no
rule is applied, no total is updated. The row is a faithful record of what the
service said happened.

That separation is what makes the platform correctable. When a posting rule turns
out to be wrong in November, the events are still exactly as they arrived and can
be re-posted under the fixed rule. If ingest had baked the interpretation in,
the original facts would be gone and the only fix would be a manual correction
nobody can audit.

`metadata` is an open `Json` column for the same reason: keep whatever the
service sent, even the parts the platform has no use for yet.

### 5 · The key scopes the query

`POST /events` never takes a `serviceId`. It comes from `ApiKeyGuard`, which put
the service on the request after verifying the key. `GET /events/:id` filters on
`{ id, serviceId }` rather than looking up by `id` alone, so a valid key for one
service cannot read another service's event even with a correct id.

An id in a URL is a request, not a permission. The scope always comes from the
credential.

## Cursor pagination

`GET /events?limit=20&cursor=<lastId>` fetches `limit + 1` rows and returns
`nextCursor` only if the extra one came back. Cursors beat `?page=3` here because
events arrive continuously: with offset paging, a new event landing between two
requests shifts everything down and page 3 shows a row you already saw on page 2.

## Checks

Import `postman/collections/revenue-platform-events.postman_collection.json` and
hit **Run**. It creates a user, a service and a key, posts an event, posts the
exact same event twice more to prove the count does not move, rejects a float
amount, rejects a bad currency, reads the event back, confirms another service's
key cannot see it, and checks the summary totals.

## Done when

- [ ] `POST /events` returns **202**
- [ ] Posting the same `externalId` again returns `duplicate: true` and the same id
- [ ] `GET /events` still shows exactly one event after three identical posts
- [ ] `amountMinor: 250000.5` is a 400
- [ ] `currency: "naira"` is a 400
- [ ] A second service's key cannot read the first service's event
- [ ] `status` is `PENDING` on every row

## Design decisions questioned in review

The Supabase session pooler on port 5432 is the correct architecture for this long-running NestJS server, while transaction mode (port 6543) is not. Prisma maintains its own internal connection pool per application process, meaning the total number of PostgreSQL connections is determined by that configured pool size rather than by incoming HTTP request concurrency. Session pooling on port 5432 provides full support for prepared statements, schema migrations, and persistent session state without connection resets. In contrast, transaction pooling (port 6543) is built for ephemeral, stateless serverless environments (such as AWS Lambda) where connections cannot be kept alive across invocations.

Next module: posting rules — `Account`, `Entry`, and the double-entry ledger that
turns a `PENDING` event into balanced entries and flips it to `POSTED`.
