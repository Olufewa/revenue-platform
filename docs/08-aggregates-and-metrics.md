# 08 — Daily aggregates and metrics (module 7)

Backend endpoints for operational and financial visibility. No frontend, no chart
library — this module provides clean JSON endpoints designed for dashboard consumption.

The code under `src/` carries no comments — the reasoning lives here.

## Run it

```bash
cd packages/server
npx prisma migrate dev --name add_daily_aggregate
npx prisma generate
npm run start:dev
```

## Routes

| Method | Route | Auth | Returns / Notes |
|---|---|---|---|
| POST | `/services/:id/aggregates/rebuild` | Bearer | `{ days, rows }` recomputed from entries |
| GET | `/services/:id/metrics?from=&to=` | Bearer | Daily series per account/currency, plus window totals |
| GET | `/services/:id/health` | Bearer | Ingestion lag, status counts, failed samples, refund rate |
| GET | `/metrics/overview?from=&to=` | Bearer (ADMIN) | Totals across every service, one row each |

`from` and `to` are optional ISO dates defaulting to the last 30 days.

---

## Key decisions worth understanding

### 1 · The dashboard reads a rollup, never raw entries

The metrics endpoints read `DailyAggregate`, never raw `Entry`. That separation is the
entire reason the table exists.

In an active system, the `Entry` table grows by millions of rows each month. Running
aggregations (`SUM`, `GROUP BY`) over millions of rows on every dashboard load or page
refresh degrades database performance and creates contention with incoming writes.
Rollups in `DailyAggregate` reduce thousands of daily entries into a single precomputed
row per account per currency per day.

### 2 · Aggregates are derived and disposable

`DailyAggregate` is never the source of truth. The ledger (`Entry`) is the source of truth.

Because aggregates can always be completely rebuilt from entries via
`POST /services/:id/aggregates/rebuild`, aggregate rows are disposable. If an aggregation
bug is discovered or an accounting definition changes, the aggregate table can be wiped
and recomputed without any risk of data loss.

### 3 · Full rebuild vs incremental rollup

`POST /services/:id/aggregates/rebuild` executes a full rebuild inside a single transaction:
it deletes all aggregate rows for that service and recomputes them from `Entry`.

In a production system with years of history, aggregates would be updated incrementally
or via a nightly scheduled job. At this stage of the platform, a full rebuild is the
honest choice: it is simple, fast, and guaranteed to be 100% correct without the edge-case
complexity of incremental windowing.

### 4 · Health numbers matter as much as revenue numbers

Financial totals tell you how much money moved; health metrics tell you whether the
system is operating reliably.

`GET /services/:id/health` computes real-time operational indicators directly from `RevenueEvent`:
- `pending`, `posted`, `failed` counts: shows queue backlog and error volume.
- `failedSamples`: up to five recent failed events with their `failureReason`, allowing
  operators to immediately diagnose configuration gaps (such as missing posting rules).
- `ingestionLagSeconds`: the maximum difference between `receivedAt` and `occurredAt`,
  revealing upstream queuing, network delays, or offline sync latency.
- `refundRateBps`: ratio of reversed minor units to posted minor units in basis points,
  highlighting abnormal refund spikes or fraud.

---

## Verification with curl

### 1 · Rebuild daily aggregates

```bash
curl -s -X POST http://localhost:3003/services/$SERVICE_ID/aggregates/rebuild \
  -H "Authorization: Bearer $TOKEN"
```
Returns `{ "days": 1, "rows": 3 }`.

### 2 · Query service metrics

```bash
curl -s "http://localhost:3003/services/$SERVICE_ID/metrics" \
  -H "Authorization: Bearer $TOKEN"
```
Returns the `series` (daily breakdown) and `totals` for the window per account and currency.

### 3 · Query service ingestion health

```bash
curl -s "http://localhost:3003/services/$SERVICE_ID/health" \
  -H "Authorization: Bearer $TOKEN"
```
Returns:
```json
{
  "pending": 0,
  "posted": 2,
  "failed": 0,
  "failedSamples": [],
  "ingestionLagSeconds": 0,
  "refundRateBps": 5000
}
```

### 4 · Admin overview across all services

```bash
curl -s "http://localhost:3003/metrics/overview" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
Returns an array of services with their respective totals.

---

## Done when

- [ ] `DailyAggregate` table exists with unique constraint on `(serviceId, accountId, currency, day)`
- [ ] `POST /services/:id/aggregates/rebuild` deletes and recomputes aggregates in one transaction
- [ ] `GET /services/:id/metrics` reads from `DailyAggregate` and returns series plus totals
- [ ] `GET /services/:id/health` returns counts, lag, refund rate, and failed samples
- [ ] `GET /metrics/overview` returns totals across all services and is restricted to ADMIN
- [ ] `from` and `to` query parameters are validated in a DTO
