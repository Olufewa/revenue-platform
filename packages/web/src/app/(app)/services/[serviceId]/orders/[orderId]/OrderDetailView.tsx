'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyAmount, Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format-date';
import { transactionStatus } from '@/lib/ledger';
import { formatMoney, type Money } from '@/lib/money';
import type { LedgerTransaction, OrderSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** The summary (which includes the order) and its transactions, together. */
async function loadOrder(serviceId: string, orderId: string) {
  const path = `/services/${encodeURIComponent(serviceId)}/orders/${encodeURIComponent(orderId)}`;
  const [summary, transactions] = await Promise.all([
    api<OrderSummary>(`${path}/summary`),
    api<LedgerTransaction[]>(`${path}/transactions`),
  ]);
  return { summary, transactions };
}

export function OrderDetailView() {
  const { serviceId, orderId } = useParams<{
    serviceId: string;
    orderId: string;
  }>();
  const load = useCallback(
    () => loadOrder(serviceId, orderId),
    [serviceId, orderId],
  );
  const { data, error, loading, reload } = useApi(load);
  const ordersHref = `/services/${encodeURIComponent(serviceId)}/orders`;

  return (
    <>
      <PageHeader
        title={data?.summary.order.externalId ?? 'Order'}
        breadcrumb={
          <ServiceBreadcrumb serviceId={serviceId}>
            <Link href={ordersHref} className="text-ink-2">
              Orders
            </Link>
          </ServiceBreadcrumb>
        }
        actions={
          data && (
            <StatusBadge
              status={data.summary.fullyRecognised ? 'posted' : 'pending'}
              label={
                data.summary.fullyRecognised
                  ? 'Fully recognised'
                  : 'Not fully recognised'
              }
            />
          )
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && <p className="text-ink-2">Loading the order…</p>}

      {data && (
        <OrderBody
          summary={data.summary}
          transactions={data.transactions}
          serviceId={serviceId}
        />
      )}
    </>
  );
}

/** A label and its value, for the details grid. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-caption text-ink-2">{label}</dt>
      <dd className="wrap-anywhere">{children}</dd>
    </div>
  );
}

/** A metadata value as text: strings as they are, anything else as JSON. */
function showValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function OrderBody({
  summary,
  transactions,
  serviceId,
}: {
  summary: OrderSummary;
  transactions: LedgerTransaction[];
  serviceId: string;
}) {
  const { order } = summary;
  const currency = order.total.currency;
  // Income in the order's own currency; other currencies are rare.
  const recognised: Money = summary.income.byCurrency.find(
    (money) => money.currency === currency,
  ) ?? { amount: '0', currency };
  const metadata = Object.entries(order.metadata ?? {});

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 grow-999 basis-120 flex-col gap-6">
        <Panel>
          <dl className="num grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-x-6 gap-y-5">
            <Detail label="Amount">
              <span className="text-section">{formatMoney(order.total)}</span>
            </Detail>
            <Detail label="Placed">{formatDateTime(order.placedAt)}</Detail>
            <Detail label="Customer ref">
              <span className="font-mono">{order.customerRef ?? '—'}</span>
            </Detail>
            <Detail label="Description">{order.description ?? '—'}</Detail>
            <Detail label="Internal ID">
              <span className="font-mono text-small">{order.id}</span>
            </Detail>
          </dl>
        </Panel>

        <Panel
          flush
          title={`Transactions · ${transactions.length}`}
          meta="Sent by the service with its API key"
        >
          {transactions.length === 0 ? (
            <p className="px-5 py-4 text-ink-2">
              No transactions yet. The order is recorded, but nothing has been
              booked against it.
            </p>
          ) : (
            transactions.map((transaction) => (
              <OrderTransaction
                key={transaction.id}
                transaction={transaction}
                serviceId={serviceId}
              />
            ))
          )}
        </Panel>

        {metadata.length > 0 && (
          <Panel title="Metadata">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 font-mono text-small">
              {metadata.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-2">{key}</dt>
                  <dd className="wrap-anywhere">{showValue(value)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
      </div>

      <aside className="flex min-w-0 grow basis-75 flex-col gap-6">
        <Panel title="Order summary">
          <div className="num flex flex-col">
            <SummaryRow label="Order amount" value={formatMoney(order.total)} />
            <SummaryRow
              label="Income recognised"
              value={formatMoney(recognised)}
            />
            <SummaryRow
              label="Transactions"
              value={
                summary.reversedCount > 0
                  ? `${summary.transactionCount} (${summary.reversedCount} reversed)`
                  : String(summary.transactionCount)
              }
            />
            <SummaryRow
              label="Left to recognise"
              value={formatMoney(summary.outstanding)}
              strong
            />
          </div>
          <p
            className={`text-small font-medium ${summary.fullyRecognised ? 'text-posted' : 'text-pending'}`}
          >
            {summary.fullyRecognised
              ? '✓ Income matches the order amount'
              : '○ Part of this order isn’t income: VAT, deferred revenue or a refund'}
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 border-b border-muted py-2.5 last:border-b-0 ${strong ? 'font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** One transaction on the order: a header line, then its entries. */
function OrderTransaction({
  transaction,
  serviceId,
}: {
  transaction: LedgerTransaction;
  serviceId: string;
}) {
  const href = `/services/${encodeURIComponent(serviceId)}/transactions/${encodeURIComponent(transaction.id)}`;
  const format = (money: Money) => formatMoney(money, { symbol: false });

  return (
    <div className="border-t border-line first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4 text-small">
        <Link href={href} className="font-mono wrap-anywhere">
          {transaction.externalId}
        </Link>
        <span className="text-ink-2">
          {formatDateTime(transaction.occurredAt)}
        </span>
        <StatusBadge size="sm" status={transactionStatus(transaction)} />
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Account</Th>
            <Th numeric>Debit ({transaction.currency})</Th>
            <Th numeric>Credit ({transaction.currency})</Th>
          </tr>
        </thead>
        <tbody>
          {transaction.entries.map((entry) => (
            <tr key={entry.id}>
              <Td className="font-mono text-small">{entry.accountCode}</Td>
              {entry.direction === 'DEBIT' ? (
                <>
                  <Td numeric>{format(entry.amount)}</Td>
                  <EmptyAmount />
                </>
              ) : (
                <>
                  <EmptyAmount />
                  <Td numeric>{format(entry.amount)}</Td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
