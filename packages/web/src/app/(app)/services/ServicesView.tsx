'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { DateRangeControl } from '@/components/layout/DateRangeControl';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { BarList, type Bar } from '@/components/ui/BarList';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { StatStrip, StatTile } from '@/components/ui/StatTile';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { RANGE_LABELS, rangeStart } from '@/lib/date-range';
import { formatCompact, formatMoney, sumMoney, type Money } from '@/lib/money';
import type { ApiKey, Balances, RevenueReport, Service } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { useWorkspaceStore } from '@/stores/workspace';

const SERIES: Bar['series'][] = [1, 2, 3, 4];

/** The same colours as the bars, written out so Tailwind finds each class. */
const DOT = {
  1: 'bg-series-1',
  2: 'bg-series-2',
  3: 'bg-series-3',
  4: 'bg-series-4',
};

interface ServiceRow {
  service: Service;
  series: Bar['series'];
  revenue: Money;
  vatPayable: Money;
  activeKeys: number;
}

/** Lists the services, then loads each one's figures at the same time. */
async function loadServices(from: string): Promise<ServiceRow[]> {
  const services = await api<Service[]>('/services');

  return Promise.all(
    services.map(async (service, index) => {
      const path = `/services/${encodeURIComponent(service.id)}`;
      const [revenue, balances, keys] = await Promise.all([
        api<RevenueReport>(
          `${path}/reports/revenue?from=${encodeURIComponent(from)}`,
        ),
        api<Balances>(`${path}/balances`),
        api<ApiKey[]>(`${path}/keys`),
      ]);
      const vat = balances.accounts.find(
        (account) => account.accountCode === 'vat_payable',
      );

      return {
        service,
        series: SERIES[index % SERIES.length],
        revenue: revenue.total,
        vatPayable: vat?.balance ?? {
          amount: '0',
          currency: service.baseCurrency,
        },
        activeKeys: keys.filter((key) => key.active).length,
      };
    }),
  );
}

export function ServicesView() {
  const dateRange = useWorkspaceStore((state) => state.dateRange);
  const load = useCallback(
    () => loadServices(rangeStart(dateRange)),
    [dateRange],
  );
  const { data: rows, error, loading, reload } = useApi(load);

  return (
    <>
      <PageHeader
        title="Services"
        breadcrumb="Workspace · all services"
        actions={
          <>
            <DateRangeControl />
            <Link
              href="/services/new"
              className={buttonStyles({ variant: 'primary' })}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M7 2v10M2 7h10" />
              </svg>
              New service
            </Link>
          </>
        }
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

      {loading && <p className="text-ink-2">Loading your services…</p>}

      {rows?.length === 0 && (
        <EmptyState title="No services yet">
          <p>
            Register each product that earns money as a service. Use New service
            to add the first one.
          </p>
        </EmptyState>
      )}

      {rows && rows.length > 0 && (
        <ServicesSummary rows={rows} rangeLabel={RANGE_LABELS[dateRange]} />
      )}
    </>
  );
}

function ServicesSummary({
  rows,
  rangeLabel,
}: {
  rows: ServiceRow[];
  rangeLabel: string;
}) {
  // Totals only make sense when every service reports in the same currency.
  const currency = rows[0].service.baseCurrency;
  const totalRevenue = sumMoney(
    rows.map((row) => row.revenue),
    currency,
  );
  const totalVat = sumMoney(
    rows.map((row) => row.vatPayable),
    currency,
  );
  const totalKeys = rows.reduce((sum, row) => sum + row.activeKeys, 0);
  const mixed = 'Services use different currencies';

  const bars: Bar[] = rows.map((row) => ({
    label: row.service.name,
    // A number is fine here: it only sets the bar's width, not what's shown.
    value: Number(row.revenue.amount),
    display: formatCompact(row.revenue),
    series: row.series,
  }));

  return (
    <>
      <StatStrip>
        <StatTile
          label="Revenue · all services"
          value={totalRevenue ? formatCompact(totalRevenue) : '—'}
          note={totalRevenue ? `Income, ${rangeLabel}` : mixed}
        />
        <StatTile
          label="VAT payable"
          value={totalVat ? formatCompact(totalVat) : '—'}
          note={totalVat ? 'Owed as of now' : mixed}
        />
        <StatTile
          label="Services"
          value={String(rows.length)}
          note="Registered to you"
        />
        <StatTile
          label="API keys"
          value={String(totalKeys)}
          note="Active across services"
        />
      </StatStrip>

      {totalRevenue && (
        <Panel
          title={`Share of revenue · ${rangeLabel}`}
          meta={`In ${currency}`}
        >
          <BarList bars={bars} />
        </Panel>
      )}

      <Panel flush title="Your services" meta="Open a service to see its books">
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Currency · timezone</Th>
              <Th numeric>Revenue</Th>
              <Th numeric>VAT payable</Th>
              <Th numeric>API keys</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.service.id}
                className="border-b border-muted last:border-b-0"
              >
                <Td className="py-3">
                  <Link
                    href={`/services/${encodeURIComponent(row.service.id)}/overview`}
                    className="inline-flex items-center gap-2 font-medium no-underline"
                  >
                    <span
                      aria-hidden
                      className={clsx('size-2 rounded-[2px]', DOT[row.series])}
                    />
                    {row.service.name}
                  </Link>
                </Td>
                <Td className="py-3 text-ink-2">
                  {row.service.baseCurrency} · {row.service.timezone}
                </Td>
                <Td numeric className="py-3">
                  {formatMoney(row.revenue)}
                </Td>
                <Td numeric className="py-3">
                  {formatMoney(row.vatPayable)}
                </Td>
                <Td numeric className="py-3">
                  {row.activeKeys}
                </Td>
              </tr>
            ))}
          </tbody>
          {totalRevenue && totalVat && (
            <tfoot>
              <tr className="border-t border-line bg-paper font-semibold">
                <Td className="py-3">Total</Td>
                <Td className="py-3" />
                <Td numeric className="py-3">
                  {formatMoney(totalRevenue)}
                </Td>
                <Td numeric className="py-3">
                  {formatMoney(totalVat)}
                </Td>
                <Td numeric className="py-3">
                  {totalKeys}
                </Td>
              </tr>
            </tfoot>
          )}
        </Table>
      </Panel>
    </>
  );
}
