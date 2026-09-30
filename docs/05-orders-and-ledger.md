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

→ `201 { duplicate, order }`. `externalId` is the product's own ID. Sending it
again returns the stored order with `duplicate: true` and never creates a second
one, so retries are always safe.

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

### Foreign currency

If the transaction currency differs from the service's base currency, send
`exchangeRate`: how many base units one unit of the transaction currency buys.

```json
{ "currency": "USD", "exchangeRate": "1550.25", "entries": [ … ] }
```

Leaving out `exchangeRate` for a foreign currency is a 400. So is sending a rate
other than 1 for the base currency itself.

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
| `GET /services/:id/reports/revenue?from=&to=` | net income per UTC day (credits − debits on `INCOME` accounts) and the window total; defaults to the last 30 days |

## Done when

- [ ] An unbalanced transaction is a 400 that names both totals
- [ ] Resending an order or a transaction returns `duplicate: true` and writes nothing
- [ ] A USD transaction with a rate stores base amounts whose debits equal its credits
- [ ] Reversing twice is a 409
- [ ] The trial balance's debit and credit totals are equal
