# 05 — Orders and the ledger

A service sends an **order** for each sale, then sends the **ledger transaction**
that records what the sale did to the money. The platform does not work out the
accounting for you: no posting rules, no background processor. What it does is
make sure every transaction balances and is stored exactly as sent.

The model follows Martin Fowler's accounting patterns (*Analysis Patterns*,
*Patterns of Enterprise Application Architecture*):

| Pattern | Here |
|---|---|
| **Money** | `src/money/money.ts`: an amount in minor units plus its currency |
| **Account** | `Account`: one row in a service's own chart of accounts |
| **Accounting Transaction** | `LedgerTransaction` + its `Entry` rows, which must balance |
| **Base currency** | `Service.baseCurrency`; every entry also stores its base amount |

## Money

Amounts are always whole **minor units** (kobo, cents), stored as `BigInt`. The
API accepts them as numbers and returns them as strings, so no client can turn
one back into a float:

```json
{ "amount": "350000", "currency": "NGN" }
```

`Money` refuses to add two different currencies. Minor units per currency come
from ISO 4217 via `Intl` (NGN and USD have 2, JPY has 0), so every ISO code works.

**Allocation** is Fowler's: to split an amount by ratios, round each part down,
then hand out the leftover minor units one at a time from the first part.
₦3,500.00 split 75 : 1000 gives ₦244.19 VAT and ₦3,255.81 net. The parts always
add up to the whole, to the kobo.

**Exchange rates** are decimal strings (`"1550.25"`), parsed into exact
fractions. Converting never uses floating point. Results round half away from
zero.

## Accounts

Each service creates its own chart of accounts:

```http
POST /services/:serviceId/accounts
{ "code": "cash", "name": "Cash received", "type": "ASSET" }
```

| Type | Grows with | Example |
|---|---|---|
| `ASSET` | debits | `cash`, `receivables` |
| `EXPENSE` | debits | `payment_fees` |
| `LIABILITY` | credits | `vat_payable` |
| `EQUITY` | credits | `retained_earnings` |
| `INCOME` | credits | `bundle_revenue` |

Codes are lowercase with underscores and are unique within a service. The
revenue report reads `INCOME` accounts.

Code and type never change once created, because entries already point at
them. What can change is the name, and whether the account is archived:

```http
PATCH /services/:serviceId/accounts/legacy_revenue
{ "archived": true }
```

An archived account refuses new entries (400 naming it). Reversals of
transactions that touched it still go through, so a mistake can always be
undone.

## Orders

```http
POST /orders                      x-api-key
{
  "externalId": "bundle-3500-1",
  "amount": 350000,
  "currency": "NGN",
  "placedAt": "2026-09-15T12:00:00.000Z",
  "description": "1GB data bundle",
  "customerRef": "+2348030001234",
  "metadata": { "channel": "ussd" }
}
```

→ `201 { duplicate, order }`. `externalId` is the product's own ID. Sending the
same request again returns the stored order with `duplicate: true` and never
creates a second one, so retries are always safe.

A retry must be the *same* request. The platform stores a hash of each body,
and key order doesn't matter. Reusing an `externalId` with a different amount,
currency or anything else is a **422**. Silently returning the original would
hide a bug in the caller. Transactions and reversals work the same way.

## Transactions

```http
POST /orders/:orderId/transactions   x-api-key
{
  "externalId": "bundle-3500-1-sale",
  "occurredAt": "2026-09-15T12:00:00.000Z",
  "description": "Bundle sale, VAT inclusive",
  "entries": [
    { "accountCode": "cash",           "direction": "DEBIT",  "amount": 350000 },
    { "accountCode": "vat_payable",    "direction": "CREDIT", "amount": 24419 },
    { "accountCode": "bundle_revenue", "direction": "CREDIT", "amount": 325581 }
  ]
}
```

A transaction is rejected with **400** unless:

- it has at least two entries and at least one on each side;
- every amount is a positive whole number of minor units;
- **debits equal credits exactly**, in the transaction currency;
- every `accountCode` exists in this service's chart.

`currency` defaults to the order's currency. It is idempotent on `externalId`
in the same way as orders. Reusing an `externalId` on a *different* order is a
**409**.

### Transactions without an order

Not everything is a sale. Payment fees, settlements and write-offs go to
`POST /transactions`. It takes the same body plus an optional `orderId`, and
`currency` is required when there is no order:

```json
{
  "externalId": "fee-2026-09-16",
  "occurredAt": "2026-09-16T18:00:00.000Z",
  "currency": "NGN",
  "entries": [
    { "accountCode": "payment_fees", "direction": "DEBIT",  "amount": 5000 },
    { "accountCode": "cash",         "direction": "CREDIT", "amount": 5000 }
  ]
}
```

### Order summary

`GET /orders/:id/summary` answers "has this order been booked?":

| Field | Meaning |
|---|---|
| `income.base` | net credits to `INCOME` accounts across the order's transactions, in base currency |
| `income.byCurrency` | the same, per transaction currency |
| `outstanding` | order total minus income booked in the order's own currency |
| `fullyRecognised` | `outstanding` is zero |

It reports and never enforces. Partial payments, refunds and corrections are
all legitimate, so a mismatch is something to look at, not an error. Income
booked in a different currency from the order can't be compared exactly, which
is why it is listed separately.

### Foreign currency

If the transaction currency differs from the service's base currency, send
`exchangeRate`: how many base units one unit of the transaction currency buys.

```json
{ "currency": "USD", "exchangeRate": "1550.25", "entries": [ … ] }
```

Leaving out `exchangeRate` for a foreign currency is a 400. So is sending a rate
other than 1 for the base currency itself.

Record where the rate came from with `rateSource` (e.g. `"CBN official
2026-09-16"`). It's stored with the transaction and copied onto its reversal,
so every base amount can be traced back to its rate.

Each entry stores its `amount` in the transaction currency **and** a
`baseAmount`. Base amounts are not converted leg by leg, because rounding each
leg separately could leave the base side a kobo out of balance. Instead the
transaction total is converted once, then **allocated** across each side in
proportion to the legs. Both sides therefore balance exactly in base currency.

### Corrections: reverse, never edit

Transactions are immutable. To undo one:

```http
POST /transactions/:id/reverse       x-api-key
{ "externalId": "bundle-3500-1-sale-reversal" }
```

This writes the mirror image: same accounts and amounts, debits and credits
swapped, linked by `reversesTransactionId`. A transaction can be reversed only
once (409 after that), and a reversal cannot itself be reversed. For a partial
refund, post a new transaction against the order for the refunded amount.

## Reports

Both reports are in the service's base currency and are computed from entries on
every request. Nothing is cached, so nothing can drift.

| Route | Returns |
|---|---|
| `GET /services/:id/balances?asOf=` | trial balance: debit, credit and normal-side balance per account, plus totals (debits always equal credits) |
| `GET /services/:id/reports/revenue?from=&to=` | net income per **local day** (credits − debits on `INCOME` accounts) and the window total; defaults to the last 30 days |

Days follow the service's `timezone` (IANA, default `Africa/Lagos`, set when
the service is created). A sale at 23:30 UTC is 00:30 in Lagos and counts
toward the next day. Grouping by UTC would book it a day early.

## Not built yet

- **An exchange-rate table.** Rates are supplied per transaction. A per-service
  rate table could fill in a missing rate automatically.
- **Realised FX gains and losses.** When a foreign-currency receivable is
  settled at a different rate, the difference should go to an FX gain/loss
  account. Today the client has to book that itself.
- **Balance snapshots.** Reports scan entries on each request, helped by an
  `(serviceId, accountId, occurredAt)` index. Periodic closing snapshots
  would bound that scan once volume calls for it.

## Done when

- [ ] An unbalanced transaction is a 400 that names both totals
- [ ] Resending an order or a transaction returns `duplicate: true` and writes nothing
- [ ] Reusing an `externalId` with a different body is a 422
- [ ] A fee posts without an order; an archived account refuses new entries
- [ ] Revenue for a 23:30 UTC sale appears on the next Lagos day
- [ ] A USD transaction with a rate stores base amounts whose debits equal its credits
- [ ] Reversing twice is a 409
- [ ] The trial balance's debit and credit totals are equal
