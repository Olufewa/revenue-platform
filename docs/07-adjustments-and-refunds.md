# 07 — Adjustments and refunds (module 6)

Nothing is ever edited or deleted in the ledger. A refund is a new event that points
at the original event. The original entries stay exactly as they were, and balances
move because new entries were added, not because old ones changed.

The code under `src/` carries no comments — the reasoning lives here.

## Run it

```bash
cd packages/server
npx prisma migrate dev --name add_event_reversal
npx prisma generate
npm run start:dev
```

## Routes

| Method | Route | Auth | Returns / Notes |
|---|---|---|---|
| POST | `/events` | `x-api-key` | Ingest with optional `reversesExternalId` |
| GET | `/services/:id/events/:eventId/adjustments` | Bearer | Reversals list, `originalAmountMinor`, `reversedMinor`, `remainingMinor` |

---

## Key decisions worth understanding

### 1 · A refund is a new event, not an edit

If an invoice is paid on Tuesday and refunded on Friday, Tuesday's financial reports
must not change on Friday. A report that was circulated to management or auditors on
Wednesday cannot have its historical numbers quietly altered.

By recording a refund as a new `RevenueEvent` (`bundle.refunded`) that links back to the
original via `reversesEventId`, the ledger preserves the complete chronological history.
Every debit and credit that ever existed remains on record.

### 2 · Over-refunding is rejected at ingest, not at posting

When an ingest request includes `reversesExternalId`, `EventsService.ingest` verifies:
1. The referenced event exists on the same service (404 if not).
2. The reversal currency matches the original currency (400 if not).
3. The sum of existing reversals plus the new amount does not exceed `original.amountMinor` (409 Conflict if exceeded).

Rejecting over-refunds at ingest prevents invalid financial commitments from entering
the system in the first place. An event that cannot be validly posted should not sit
in the database as `PENDING`.

### 3 · A refund needs no new posting machinery

A refund posts through the exact same posting rule engine as any other event. The service
registers a `bundle.refunded` rule:
- `DEBIT  deferred_revenue  1000/1075`
- `DEBIT  vat_payable       75/1075`
- `CREDIT cash              1/1`

There is zero refund-specific logic inside the posting pipeline. No `if (event.reversesEventId)`
branches exist. The ledger does not need special cases for reversals because double-entry
bookkeeping naturally handles reversals through complementary debit and credit lines.

### 4 · Why the `refunds` account exists but is not used here

The chart of accounts includes a `refunds` account (`REVENUE` type). However, for
`bundle.refunded`, revenue was still in `deferred_revenue` (a liability) because the bundle
had not yet been consumed. Refunding it unwinds the liability: `deferred_revenue` is debited
and `cash` is credited.

If the revenue had already been recognized (e.g. data consumed), the refund would debit
`refunds` (contra-revenue) rather than reducing historical `earned_revenue`. This ensures
the prior period's earned revenue is never retroactively rewritten, while the refund is
explicitly visible as a separate revenue deduction in the current period.

---

## Before / After: Half Refund of the ₦3,500 Bundle

### 1 · Initial Purchase (₦3,500.00 = 350,000 kobo)

Event: `bundle.purchased` for 350,000 kobo.
Entries posted:
- `cash`: DEBIT 350,000
- `vat_payable`: CREDIT 24,419
- `deferred_revenue`: CREDIT 325,581

Balances:
- `cash` (ASSET): **+350,000** (₦3,500.00)
- `vat_payable` (LIABILITY): **+24,419** (₦244.19)
- `deferred_revenue` (LIABILITY): **+325,581** (₦3,255.81)

### 2 · Half Refund (₦1,750.00 = 175,000 kobo)

Event: `bundle.refunded` with `reversesExternalId`, amount 175,000 kobo.
Entries posted:
- `deferred_revenue`: DEBIT 162,791 ($(175000 \times 1000 + 537) / 1075$)
- `vat_payable`: DEBIT 12,209 (remainder: $175000 - 162791$)
- `cash`: CREDIT 175,000

Balances after refund:
- `cash`: $350000 - 175000 =$ **+175,000** (₦1,750.00)
- `vat_payable`: $24419 - 12209 =$ **+12,210** (₦122.10)
- `deferred_revenue`: $325581 - 162791 =$ **+162,790** (₦1,627.90)

The original three entries are completely untouched. Three new entries were appended.
The balances moved solely because new entries were added.

---

## Done when

- [ ] `POST /events` with valid `reversesExternalId` stores `reversesEventId`
- [ ] Over-refunding beyond the original event's remaining amount returns **409 Conflict**
- [ ] Reversing an unknown event returns **404 Not Found**
- [ ] Currency mismatch between original and reversal returns **400 Bad Request**
- [ ] `bundle.refunded` posts through the standard posting engine with no special-case code
- [ ] `GET /services/:id/events/:eventId/adjustments` lists reversals with remaining amount
- [ ] Balances reflect the net position while original ledger entries remain untouched
