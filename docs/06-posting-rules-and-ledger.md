# 06 — Posting rules and the double-entry ledger (module 5)

A `RevenueEvent` is a fact a product reported: "we sold a bundle for ₦3,500 at 12:00."
The ledger decides what that fact *means* financially: cash was received, VAT was incurred,
and revenue was deferred until data is consumed.

The rules that govern that meaning are configuration rows in the database, not code.
The code under `src/` carries no comments — the reasoning lives here.

## Run it

```bash
cd packages/server
npx prisma migrate dev --name add_ledger
npx prisma generate
npm run start:dev
```

## Routes

All routes require Bearer auth (JWT). Service-specific routes are scoped through `assertCanAccess` (service owner or ADMIN).

| Method | Route | Auth | Returns / Notes |
|---|---|---|---|
| GET | `/accounts` | Bearer | The chart of accounts |
| POST | `/services/:id/posting-rules` | Bearer | **201**, creates an immutable dated posting rule |
| GET | `/services/:id/posting-rules` | Bearer | Posting rules for this service, newest `effectiveFrom` first |
| POST | `/services/:id/events/post` | Bearer | `{ posted, failed, skipped }` counts |
| GET | `/services/:id/entries` | Bearer | Cursor-paginated ledger entries |
| GET | `/services/:id/balances` | Bearer | Derived balances per account per currency |

---

## Key decisions worth understanding

### 1 · Products report facts, the tracker decides meaning

A service should never tell the platform "credit deferred revenue." Services know what
happened in their domain (e.g. `bundle.purchased`, `data.consumed`). They do not know
MTN's accounting policies, tax jurisdictions, or chart of accounts.

If services decided accounting treatment, changing how VAT is handled would require
coordinating deployments across dozens of microservices. By ingesting raw facts and
interpreting them through ledger posting rules, accounting policies change in one place
without touching a single line of product code.

### 2 · Rules are dated rows, never edited rows

A `PostingRule` has an `effectiveFrom` timestamp and is **strictly immutable**. There is
no `PATCH` and no `DELETE` endpoint for posting rules.

When VAT changes from 7.5% to 10% on July 1st, we do not edit the existing rule. Editing
the rule would mean re-evaluating June's transactions under July's tax rate. Instead, we
insert a new rule row with `effectiveFrom: '2026-07-01T00:00:00.000Z'`.

When an event is posted, the engine selects the rule for that `(serviceId, eventType)`
with the greatest `effectiveFrom` that is `<= event.occurredAt`.

Selecting on `occurredAt` rather than `receivedAt` ensures that a late-arriving event
(e.g., an offline transaction synced days later) is accounted for under the rule that was
in force when the transaction actually happened.

### 3 · Explicit fractions instead of basis points (inclusive VAT)

Each line in a posting rule is defined as `{ accountCode, direction, numerator, denominator }`.

Why not basis points (`bps`)?
In Nigeria, VAT is legally inclusive. A customer buying a ₦3,500 bundle pays exactly ₦3,500.
The VAT component is:

$$\text{VAT} = 3500 \times \frac{7.5}{107.5} = 244.186... \approx ₦244.19$$

As basis points, $244.19 / 3500 = 6.9767\% = 697.67$ bps. That is not an integer.
Basis points cannot express inclusive VAT without precision loss.

An explicit integer fraction expresses both inclusive VAT ($75/1075$) and plain percentages
($750/10000$) with 100% mathematical precision for one extra integer field.

For `bundle.purchased`, the rule lines are:
- `DEBIT  cash              1/1`
- `CREDIT vat_payable       75/1075`
- `CREDIT deferred_revenue  1000/1075`

Validation at rule creation guarantees:
- At least one `DEBIT` line and one `CREDIT` line
- All lines on the same side share the same denominator ($1075$)
- Numerators on each side sum to exactly that denominator ($75 + 1000 = 1075$)
- Every `accountCode` exists in the `Account` table

### 4 · Half-up integer allocation and remainder absorption

Allocations are computed strictly with integer math on `BigInt`, never floating point:

$$\text{lineAmount} = \left\lfloor \frac{\text{amountMinor} \times \text{numerator} + \lfloor \text{denominator} / 2 \rfloor}{\text{denominator}} \right\rfloor$$

Adding `denominator / 2n` before dividing implements standard **half-up rounding**.

Because integer division discards fractions, the sum of line amounts may differ from
the total event amount by a few minor units. The rule engine enforces that **the last line
on each side absorbs the rounding remainder**:

$$\text{lastLineAmount} = \text{amountMinor} - \sum \text{previousLineAmounts}$$

For a ₦3,500 bundle (350,000 kobo):
1. `cash`: $350000 \times 1 / 1 = 350000$ (₦3,500.00)
2. `vat_payable`: $(350000 \times 75 + 537) / 1075 = 24419$ (₦244.19)
3. `deferred_revenue`: absorbs remainder: $350000 - 24419 = 325581$ (₦3,255.81)

Debits ($350000$) and credits ($24419 + 325581 = 350000$) balance to the exact kobo.

### 5 · Debits equal credits is a hard invariant

Double-entry bookkeeping requires that total debits equal total credits for every event.
This is enforced in two places:
1. Pure allocation function: asserts `sum(debits) === sum(credits) === amountMinor`.
2. Database transaction: if the assertion fails, an exception is thrown, rolling back
   all entry creation and keeping the event `PENDING`.

### 6 · Derived balances vs stored balances

Balances are never stored as columns on `Account`. They are derived via a `groupBy` over
`Entry` on demand:
- For `ASSET` accounts: $\text{balance} = \sum \text{DEBIT} - \sum \text{CREDIT}$
- For `LIABILITY` and `REVENUE` accounts: $\text{balance} = \sum \text{CREDIT} - \sum \text{DEBIT}$

A stored balance is a cache that can drift from the ledger. Deriving balances ensures
the balance is always the mathematical truth of the entries on record.

### 7 · Missing rules fail with a reason, never dropped

If an event arrives for an event type that has no applicable rule, the event is marked
`FAILED` with `failureReason`:
`No posting rule for <type> effective at <occurredAt>`

The event is preserved. When the missing rule is registered, the event can be posted
without re-ingesting it from the product service.

### 8 · Synchronous posting endpoint stands in for an async worker

In production, an asynchronous queue worker (e.g. BullMQ or Kafka) would consume
`PENDING` events and post them.

`POST /services/:id/events/post` stands in for that background worker. The architectural
seam is already correct: ingest returns `202 Accepted` and writes a `PENDING` row; it never
posts inline. When a queue worker is added later, it simply calls the same `postEvents`
service method.

Each posting run caps its fetch at 500 `PENDING` events so a single call cannot grow
unbounded or time out under high ingest volume.

### 9 · Atomic status update: the check is a race, the write is the guarantee

To prevent race conditions where two concurrent post runs process the same event:

```ts
const updated = await tx.revenueEvent.updateMany({
  where: { id: event.id, status: 'PENDING' },
  data: { status: 'POSTED', failureReason: null },
});
if (updated.count === 0) {
  throw new EventNotPendingError();
}
```

Reading `event.status` first is a race. Updating with `where: { id, status: 'PENDING' }`
ensures only one worker wins the write lock; any runner seeing `count === 0` throws
`EventNotPendingError`, rolls back the transaction, and counts the event as `skipped`.

Crucially, only a lost race is treated as a skip. Any other error (e.g. malformed rule,
database constraint failure) is caught outside the rolled-back transaction, updates the
event to `FAILED` with the error message as `failureReason`, and increments `failed`.
The event is quarantined with a reason, never dropped or left silently `PENDING`.

### 10 · Append-only ledger

Entries are strictly append-only. There is no `PATCH`, no `PUT`, and no `DELETE` endpoint
for `Entry`. In this learning architecture, append-only is enforced by the fact that no update
or delete code path exists in the application. In high-security production environments,
PostgreSQL table triggers or row-level security revoke `UPDATE` and `DELETE` privileges
at the database level.

---

## Verification with curl

### 1 · Check Chart of Accounts

```bash
curl -s http://localhost:3003/accounts \
  -H "Authorization: Bearer $TOKEN"
```
Returns 5 accounts: `cash` (ASSET), `vat_payable` (LIABILITY), `deferred_revenue` (LIABILITY), `earned_revenue` (REVENUE), `refunds` (REVENUE).

### 2 · Create posting rule for `bundle.purchased`

```bash
curl -s -X POST http://localhost:3003/services/$SERVICE_ID/posting-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "bundle.purchased",
    "effectiveFrom": "2026-01-01T00:00:00.000Z",
    "lines": [
      { "accountCode": "cash", "direction": "DEBIT", "numerator": 1, "denominator": 1 },
      { "accountCode": "vat_payable", "direction": "CREDIT", "numerator": 75, "denominator": 1075 },
      { "accountCode": "deferred_revenue", "direction": "CREDIT", "numerator": 1000, "denominator": 1075 }
    ]
  }'
```
Returns **201 Created**.

### 3 · Ingest ₦3,500 bundle event

```bash
curl -s -X POST http://localhost:3003/events \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "bundle-001",
    "type": "bundle.purchased",
    "amountMinor": 350000,
    "currency": "NGN",
    "occurredAt": "2026-09-15T12:00:00.000Z"
  }'
```
Returns **202 Accepted**.

### 4 · Ingest an unconfigured event

```bash
curl -s -X POST http://localhost:3003/events \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "unconfigured-001",
    "type": "unconfigured.event",
    "amountMinor": 100000,
    "currency": "NGN",
    "occurredAt": "2026-09-15T12:05:00.000Z"
  }'
```
Returns **202 Accepted**.

### 5 · Post pending events

```bash
curl -s -X POST http://localhost:3003/services/$SERVICE_ID/events/post \
  -H "Authorization: Bearer $TOKEN"
```
Returns:
```json
{
  "posted": 1,
  "failed": 1,
  "skipped": 0
}
```

### 6 · Verify failed event has reason

```bash
curl -s http://localhost:3003/services/$SERVICE_ID/events \
  -H "Authorization: Bearer $TOKEN"
```
The `unconfigured-001` event shows:
- `status`: `"FAILED"`
- `failureReason`: `"No posting rule for unconfigured.event effective at 2026-09-15T12:05:00.000Z"`

### 7 · Verify entries for ₦3,500 bundle

```bash
curl -s http://localhost:3003/services/$SERVICE_ID/entries \
  -H "Authorization: Bearer $TOKEN"
```
Entries for `bundle-001` show:
- `cash`: `DEBIT`, `amountMinor`: `"350000"` (₦3,500.00)
- `vat_payable`: `CREDIT`, `amountMinor`: `"24419"` (₦244.19)
- `deferred_revenue`: `CREDIT`, `amountMinor`: `"325581"` (₦3,255.81)

### 8 · Verify derived balances

```bash
curl -s http://localhost:3003/services/$SERVICE_ID/balances \
  -H "Authorization: Bearer $TOKEN"
```
Returns:
```json
[
  {
    "accountCode": "cash",
    "accountName": "Cash received",
    "currency": "NGN",
    "debitMinor": "350000",
    "creditMinor": "0",
    "balanceMinor": "350000"
  },
  {
    "accountCode": "deferred_revenue",
    "accountName": "Deferred revenue",
    "currency": "NGN",
    "debitMinor": "0",
    "creditMinor": "325581",
    "balanceMinor": "325581"
  },
  {
    "accountCode": "vat_payable",
    "accountName": "VAT payable",
    "currency": "NGN",
    "debitMinor": "0",
    "creditMinor": "24419",
    "balanceMinor": "24419"
  }
]
```

---

## Done when

- [ ] `GET /accounts` returns the 5 seeded chart of accounts
- [ ] `POST /services/:id/posting-rules` validates lines and creates an immutable rule
- [ ] `POST /services/:id/events/post` posts pending events in chronological order
- [ ] ₦3,500 bundle splits exactly to ₦3,500.00 cash, ₦244.19 VAT, and ₦3,255.81 deferred revenue
- [ ] Running `post` twice returns `skipped` and creates no duplicate entries
- [ ] Event with missing rule becomes `FAILED` with `failureReason`
- [ ] `GET /services/:id/balances` derives correct account balances
- [ ] `npm run test` passes allocation tests
