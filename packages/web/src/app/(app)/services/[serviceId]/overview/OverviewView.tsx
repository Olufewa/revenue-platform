'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DateRangeControl } from '@/components/layout/DateRangeControl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { LineChart } from '@/components/ui/LineChart';
import { Panel } from '@/components/ui/Panel';
import { StatStrip, StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { RANGE_LABELS, rangeStart } from '@/lib/date-range';
import { formatCompact, formatMoney, sumMoney, type Money } from '@/lib/money';
import type {
  Balances,
  LedgerTransaction,
  RevenueReport,
  Service,
} from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { useWorkspaceStore } from '@/stores/workspace';

/** Refresh the figures this often while the page is open. */
const REFRESH_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface OverviewData {
  /** When the range starts, how many days it covers, and when the one before starts. */
  from: string;
  days: number;
  previousFrom: string;
  service: Service;
  revenue: RevenueReport;
  previous: RevenueReport;
  balances: Balances;
  recent: LedgerTransaction[];
}

/**
 * Everything the page shows, in one go. "Previous" is the same number of
 * days just before the range, for the comparison line and the change figure.
 */
async function loadOverview(serviceId: string, from: string) {
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const start = new Date(from).getTime();
  const days = Math.max(1, Math.ceil((Date.now() - start) / DAY_MS));
  const previousFrom = new Date(start - days * DAY_MS).toISOString();

  const [service, revenue, previous, balances, recent] = await Promise.all([
    api<Service>(path),
    api<RevenueReport>(
      `${path}/reports/revenue?from=${encodeURIComponent(from)}`,
    ),
    api<RevenueReport>(
      `${path}/reports/revenue?from=${encodeURIComponent(previousFrom)}&to=${encodeURIComponent(from)}`,
    ),
    api<Balances>(`${path}/balances`),
    api<{ transactions: LedgerTransaction[] }>(`${path}/transactions?limit=5`),
  ]);

  return {
    from,
    days,
    previousFrom,
    service,
    revenue,
    previous,
    balances,
    recent: recent.transactions,
  } satisfies OverviewData;
}

/**
 * One value per day from `from` to now, with 0 for days with no income (the
 * API leaves them out). Days are named in the service's timezone, as the API
 * names them.
 */
function dailyValues(report: RevenueReport, from: string, days: number) {
  const dayName = new Intl.DateTimeFormat('en-CA', {
    timeZone: report.timezone,
  });
  const byDay = new Map(
    report.series.map((point) => [point.day, Number(point.amount.amount)]),
  );
  const start = new Date(from).getTime();

  return Array.from(
    { length: days },
    (_, index) => byDay.get(dayName.format(start + index * DAY_MS)) ?? 0,
  );
}

/** `▲ 9.8%` or `▼ 3.1%`, or nothing when there was no revenue before. */
function change(current: Money, previous: Money) {
  const before = Number(previous.amount);
  if (before === 0) return null;
  const percent = ((Number(current.amount) - before) / before) * 100;
  return {
    text: `${percent >= 0 ? '▲' : '▼'} ${Math.abs(percent).toFixed(1)}%`,
    tone: percent >= 0 ? ('positive' as const) : ('negative' as const),
  };
}

const zero = (currency: string): Money => ({ amount: '0', currency });

export function OverviewView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const dateRange = useWorkspaceStore((state) => state.dateRange);
  const load = useCallback(
    () => loadOverview(serviceId, rangeStart(dateRange)),
    [serviceId, dateRange],
  );
  const { data, error, loading, reload } = useApi(load, REFRESH_MS);

  return (
    <>
      <PageHeader
        title="Overview"
        breadcrumb={
          <>
            <Link href="/services" className="text-ink-2">
              Services
            </Link>{' '}
            / <span className="text-ink">{data?.service.name ?? '…'}</span>
          </>
        }
        actions={<DateRangeControl />}
      />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {error}
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      {loading && <p className="text-ink-2">Loading the overview…</p>}

      {data && (
        <OverviewBody
          data={data}
          rangeLabel={RANGE_LABELS[dateRange]}
          serviceId={serviceId}
        />
      )}
    </>
  );
}

function OverviewBody({
  data,
  rangeLabel,
  serviceId,
}: {
  data: OverviewData;
  rangeLabel: string;
  serviceId: string;
}) {
  const { from, days, previousFrom, service, revenue, previous, balances } =
    data;
  const currency = service.baseCurrency;
  const path = `/services/${encodeURIComponent(serviceId)}`;

  const balanceOf = (code: string) =>
    balances.accounts.find((account) => account.accountCode === code)
      ?.balance ?? zero(currency);
  const movement = change(revenue.total, previous.total);

  // The chart: one point per day in the range, and the same days before it.
  const current = dailyValues(revenue, from, days);
  const before = dailyValues(previous, previousFrom, days);
  const max = Math.max(...current, ...before, 0);
  const best = revenue.series.reduce<RevenueReport['series'][number] | null>(
    (top, point) =>
      !top || BigInt(point.amount.amount) > BigInt(top.amount.amount)
        ? point
        : top,
    null,
  );
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });

  const debits = balances.totals.debit;
  const balanced = debits.amount === balances.totals.credit.amount;

  return (
    <>
      <StatStrip>
        <StatTile
          label="Revenue"
          value={formatCompact(revenue.total)}
          change={movement?.text}
          tone={movement?.tone}
          note={movement ? 'vs the period before' : `Income, ${rangeLabel}`}
        />
        <StatTile
          label="VAT payable"
          value={formatCompact(balanceOf('vat_payable'))}
          note="Owed as of now"
        />
        <StatTile
          label="Cash received"
          value={formatCompact(balanceOf('cash'))}
          note="All time, as of now"
        />
        <StatTile
          label="Best day"
          value={best ? formatCompact(best.amount) : '—'}
          note={best ? shortDate(best.day) : `No income ${rangeLabel}`}
        />
      </StatStrip>

      <Panel
        title="Daily revenue"
        meta={
          <span className="flex gap-4.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-ink" aria-hidden />
              This period
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-4 border-t-2 border-dashed border-ink-faint"
                aria-hidden
              />
              Period before
            </span>
          </span>
        }
      >
        {days < 2 ? (
          <p className="text-ink-2">
            Pick 7D, 30D or MTD to see revenue day by day.
          </p>
        ) : (
          <div className="flex gap-3">
            <div className="num flex h-60 w-12 shrink-0 flex-col justify-between text-right text-caption text-ink-2">
              <span>{formatCompact({ amount: String(max), currency })}</span>
              <span>
                {formatCompact({
                  amount: String(Math.round(max / 2)),
                  currency,
                })}
              </span>
              <span>0</span>
            </div>
            <div className="flex min-w-0 grow flex-col gap-2">
              <LineChart
                current={current}
                previous={before}
                max={max}
                label={`Daily revenue for ${service.name}, ${rangeLabel}, with the period before dashed`}
              />
              <div className="num flex justify-between text-caption text-ink-2">
                <span>{shortDate(from)}</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] items-start gap-6">
        <Panel
          title="Balances"
          meta={<Link href={`${path}/reports`}>Balance sheet →</Link>}
        >
          <div className="num flex flex-col">
            {balances.accounts.map((account) => (
              <div
                key={account.accountCode}
                className="flex justify-between gap-3 border-b border-line py-2.5"
              >
                <span>
                  {account.accountCode}{' '}
                  <span className="text-caption text-ink-2">
                    · {account.type.toLowerCase()}
                  </span>
                </span>
                <span>{formatMoney(account.balance, { symbol: false })}</span>
              </div>
            ))}
            <div
              className={`flex justify-between gap-3 pt-3 text-small font-medium ${balanced ? 'text-posted' : 'text-reversed'}`}
            >
              <span>
                {balanced
                  ? 'Debits equal credits'
                  : 'Debits and credits differ'}
              </span>
              <span>
                {balanced ? '✓' : '✕'} {formatMoney(debits)}
              </span>
            </div>
          </div>
        </Panel>

        <Panel
          flush
          title="Recent transactions"
          meta={<Link href={`${path}/transactions`}>View all →</Link>}
        >
          {data.recent.length === 0 ? (
            <p className="px-5 py-4 text-ink-2">No transactions yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Transaction</Th>
                  <Th numeric>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((transaction) => {
                  const amount = sumMoney(
                    transaction.entries
                      .filter((entry) => entry.direction === 'DEBIT')
                      .map((entry) => entry.amount),
                    transaction.currency,
                  );

                  return (
                    <tr
                      key={transaction.id}
                      className="border-b border-muted last:border-b-0"
                    >
                      <Td className="py-2.5 text-ink-2">
                        {new Date(transaction.occurredAt).toLocaleTimeString(
                          'en-GB',
                        )}
                      </Td>
                      <Td className="py-2.5 font-mono text-small wrap-anywhere">
                        {transaction.externalId}
                      </Td>
                      <Td numeric className="py-2.5">
                        {amount ? formatMoney(amount) : '—'}
                      </Td>
                      <Td className="py-2.5">
                        <StatusBadge
                          size="sm"
                          status={
                            transaction.reversedByTransactionId
                              ? 'reversed'
                              : 'posted'
                          }
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
