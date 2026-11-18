'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ColumnChart } from '@/components/ui/ColumnChart';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Panel } from '@/components/ui/Panel';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { dailyValues } from '@/lib/daily-series';
import {
  formatCompact,
  formatMoney,
  percentChange,
  type Money,
} from '@/lib/money';
import {
  dayCount,
  formatWindow,
  periodWindow,
  previousWindow,
  type CustomDates,
  customDatesReady,
  type DateWindow,
  type Period,
} from '@/lib/report-period';
import type {
  IncomeStatement,
  RevenueReport,
  StatementSection,
} from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { PeriodControls, type PeriodProps } from './PeriodControls';

const DAY_MS = 24 * 60 * 60 * 1000;

interface IncomeData {
  window: DateWindow;
  previousWindow: DateWindow;
  current: IncomeStatement;
  previous: IncomeStatement;
  revenue: RevenueReport;
  /** One value per day, for the chart. */
  daily: number[];
  /** Which column is today, if today is in the window. */
  todayIndex?: number;
}

/** `?from=…&to=…` for a window. */
const query = ({ from, to }: DateWindow) =>
  `?${new URLSearchParams({ from, to })}`;

/**
 * The statement for the period and for the one before it, plus the daily
 * revenue for the chart: three requests at once. "Now" is read here, in the
 * loader, not while rendering (the same rule as the Overview).
 */
async function loadIncome(
  serviceId: string,
  period: Period,
  custom: CustomDates,
): Promise<IncomeData | null> {
  const now = new Date();
  const window = periodWindow(period, now, custom);
  if (!window) return null;
  const before = previousWindow(period, window);
  const path = `/services/${encodeURIComponent(serviceId)}`;

  const [current, previous, revenue] = await Promise.all([
    api<IncomeStatement>(`${path}/reports/income-statement${query(window)}`),
    api<IncomeStatement>(`${path}/reports/income-statement${query(before)}`),
    api<RevenueReport>(`${path}/reports/revenue${query(window)}`),
  ]);

  const from = new Date(window.from).getTime();
  // Month to date ends at "now" exactly, so today counts when now <= to.
  const inWindow =
    now.getTime() >= from && now.getTime() <= new Date(window.to).getTime();

  return {
    window,
    previousWindow: before,
    current,
    previous,
    revenue,
    daily: dailyValues(revenue, window.from, dayCount(window)),
    todayIndex: inWindow
      ? Math.floor((now.getTime() - from) / DAY_MS)
      : undefined,
  };
}

export function IncomeStatementTab({
  serviceId,
  ...periodProps
}: PeriodProps & { serviceId: string }) {
  const { period, custom } = periodProps;
  const load = useCallback(
    () => loadIncome(serviceId, period, custom),
    [serviceId, period, custom],
  );
  const { data, error, loading, reload } = useApi(load);
  const ready = period !== 'Custom' || customDatesReady(custom);

  return (
    <>
      <PeriodControls
        {...periodProps}
        onRefresh={reload}
        summary={
          data
            ? `${formatWindow(data.window)} · compared with ${formatWindow(data.previousWindow)}`
            : undefined
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {!ready && <p className="text-ink-2">Pick a start and an end day.</p>}
      {ready && loading && (
        <p className="text-ink-2">Loading the income statement…</p>
      )}

      {data && (
        <>
          <RevenueByDay data={data} />
          <StatementTable data={data} serviceId={serviceId} />
        </>
      )}
    </>
  );
}

function RevenueByDay({ data }: { data: IncomeData }) {
  const { revenue, window, daily, todayIndex } = data;
  const peak = revenue.series.reduce<RevenueReport['series'][number] | null>(
    (top, point) =>
      !top || BigInt(point.amount.amount) > BigInt(top.amount.amount)
        ? point
        : top,
    null,
  );
  const shortDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  const lastDay = new Date(new Date(window.to).getTime() - 1).toISOString();

  return (
    <Panel
      title="Revenue by day"
      meta={
        peak ? (
          <span className="num">
            Peak {formatCompact(peak.amount)} on {shortDay(peak.day)}
            {todayIndex !== undefined && ' · today in gold'}
          </span>
        ) : (
          'No income in this period'
        )
      }
    >
      <ColumnChart
        values={daily}
        highlight={todayIndex}
        label={`Revenue per day, ${formatWindow(window)}`}
      />
      <div className="num flex justify-between text-caption text-ink-2">
        <span>{shortDay(window.from)}</span>
        <span>{shortDay(lastDay)}</span>
      </div>
    </Panel>
  );
}

/** `+9.8%` in green or `−3.1%` in red. For expenses, going up is the bad way. */
function ChangeCell({
  current,
  previous,
  upIsGood = true,
}: {
  current: Money;
  previous: Money;
  upIsGood?: boolean;
}) {
  const percent = percentChange(current, previous);
  if (percent === null) {
    return (
      <Td numeric className="text-ink-faint">
        —
      </Td>
    );
  }
  // Under 0.05% rounds to 0.0%: no direction, so no colour.
  if (Math.abs(percent) < 0.05) {
    return (
      <Td numeric className="text-ink-2">
        0.0%
      </Td>
    );
  }
  const good = percent > 0 === upIsGood;

  return (
    <Td
      numeric
      className={clsx('font-medium', good ? 'text-posted' : 'text-reversed')}
    >
      {percent >= 0 ? '+' : '−'}
      {Math.abs(percent).toFixed(1)}%
    </Td>
  );
}

function SectionRows({
  title,
  current,
  previous,
  upIsGood,
  empty,
}: {
  title: string;
  current: StatementSection;
  previous: StatementSection;
  upIsGood: boolean;
  empty: ReactNode;
}) {
  const amount = (money: Money) => formatMoney(money, { symbol: false });

  return (
    <>
      <tr className="border-b border-muted bg-paper">
        <td
          colSpan={4}
          className="px-5 py-2.5 text-caption font-semibold tracking-[0.06em] uppercase"
        >
          {title}
        </td>
      </tr>
      {current.lines.length === 0 ? (
        <tr className="border-b border-muted">
          <Td className="py-3 text-ink-2">{empty}</Td>
          <Td numeric className="py-3 text-ink-2">
            {amount(current.total)}
          </Td>
          <Td numeric className="py-3 text-ink-2">
            {amount(previous.total)}
          </Td>
          <Td />
        </tr>
      ) : (
        current.lines.map((line) => {
          // Both statements list every account, so the code finds its match.
          const before = previous.lines.find(
            (other) => other.accountCode === line.accountCode,
          )?.amount ?? { amount: '0', currency: line.amount.currency };

          return (
            <tr key={line.accountCode} className="border-b border-muted">
              <Td className="py-3">
                <span className="font-mono text-small">{line.accountCode}</span>{' '}
                <span className="text-ink-2">· {line.accountName}</span>
              </Td>
              <Td numeric className="py-3">
                {amount(line.amount)}
              </Td>
              <Td numeric className="py-3 text-ink-2">
                {amount(before)}
              </Td>
              <ChangeCell
                current={line.amount}
                previous={before}
                upIsGood={upIsGood}
              />
            </tr>
          );
        })
      )}
      <tr className="border-b border-muted font-semibold">
        <Td className="py-3">Total {title.toLowerCase()}</Td>
        <Td numeric className="py-3">
          {amount(current.total)}
        </Td>
        <Td numeric className="py-3">
          {amount(previous.total)}
        </Td>
        <Td />
      </tr>
    </>
  );
}

function StatementTable({
  data,
  serviceId,
}: {
  data: IncomeData;
  serviceId: string;
}) {
  const { current, previous } = data;
  const currency = current.baseCurrency;

  return (
    <Panel flush title="Income statement" meta={`Amounts in ${currency}`}>
      <Table className="min-w-[38rem]">
        <thead>
          <tr>
            <Th>Account</Th>
            <Th numeric>This period</Th>
            <Th numeric>Period before</Th>
            <Th numeric>Change</Th>
          </tr>
        </thead>
        <tbody>
          <SectionRows
            title="Income"
            current={current.income}
            previous={previous.income}
            upIsGood
            empty="No income accounts yet."
          />
          <SectionRows
            title="Expenses"
            current={current.expenses}
            previous={previous.expenses}
            upIsGood={false}
            empty={
              <>
                No expense accounts yet.{' '}
                <Link
                  href={`/services/${encodeURIComponent(serviceId)}/accounts`}
                >
                  Add one
                </Link>{' '}
                to track refunds or fees.
              </>
            }
          />
          <tr className="border-t-2 border-ink text-panel-title font-semibold">
            <Td className="py-4">Net income</Td>
            <Td numeric className="py-4">
              {formatMoney(current.netIncome, { symbol: false })}
            </Td>
            <Td numeric className="py-4">
              {formatMoney(previous.netIncome, { symbol: false })}
            </Td>
            <ChangeCell
              current={current.netIncome}
              previous={previous.netIncome}
            />
          </tr>
        </tbody>
      </Table>
    </Panel>
  );
}
