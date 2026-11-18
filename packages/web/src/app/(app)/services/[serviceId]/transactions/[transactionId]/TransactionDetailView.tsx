'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TAccount } from '@/components/ui/TAccount';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format-date';
import { toLegs, transactionStatus } from '@/lib/ledger';
import type { LedgerTransaction, Order } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * The transaction, then what it links to: its order, and the transaction that
 * reversed it (or that it reverses), so the page can show their names.
 */
async function loadTransaction(serviceId: string, transactionId: string) {
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const transaction = await api<LedgerTransaction>(
    `${path}/transactions/${encodeURIComponent(transactionId)}`,
  );

  const relatedId =
    transaction.reversedByTransactionId ?? transaction.reversesTransactionId;
  const [order, related] = await Promise.all([
    transaction.orderId
      ? api<Order>(`${path}/orders/${encodeURIComponent(transaction.orderId)}`)
      : null,
    relatedId
      ? api<LedgerTransaction>(
          `${path}/transactions/${encodeURIComponent(relatedId)}`,
        )
      : null,
  ]);

  return { transaction, order, related };
}

export function TransactionDetailView() {
  const { serviceId, transactionId } = useParams<{
    serviceId: string;
    transactionId: string;
  }>();
  const load = useCallback(
    () => loadTransaction(serviceId, transactionId),
    [serviceId, transactionId],
  );
  const { data, error, loading, reload } = useApi(load);
  const path = `/services/${encodeURIComponent(serviceId)}`;

  return (
    <>
      <PageHeader
        title={data?.transaction.externalId ?? 'Transaction'}
        breadcrumb={
          <ServiceBreadcrumb serviceId={serviceId}>
            <Link href={`${path}/transactions`} className="text-ink-2">
              Transactions
            </Link>
          </ServiceBreadcrumb>
        }
        actions={
          data && <StatusBadge status={transactionStatus(data.transaction)} />
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && <p className="text-ink-2">Loading the transaction…</p>}

      {data && <TransactionBody {...data} path={path} />}
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-caption text-ink-2">{label}</dt>
      <dd className="wrap-anywhere">{children}</dd>
    </div>
  );
}

function TransactionBody({
  transaction,
  order,
  related,
  path,
}: {
  transaction: LedgerTransaction;
  order: Order | null;
  related: LedgerTransaction | null;
  path: string;
}) {
  const { debits, credits } = toLegs(transaction);
  const relatedLink = related && (
    <Link
      href={`${path}/transactions/${encodeURIComponent(related.id)}`}
      className="font-mono text-inherit"
    >
      {related.externalId}
    </Link>
  );

  return (
    <>
      {transaction.reversedByTransactionId && (
        <div
          role="status"
          className="rounded-control bg-reversed-wash px-4 py-3 text-reversed"
        >
          <strong className="font-semibold">Reversed</strong> by{' '}
          {relatedLink ?? 'another transaction'}
          {related && <> on {formatDateTime(related.occurredAt)}</>}. The
          original stays in the ledger for the audit trail.
        </div>
      )}

      {transaction.reversesTransactionId && (
        <div
          role="status"
          className="rounded-control bg-duplicate-wash px-4 py-3 text-duplicate"
        >
          <strong className="font-semibold">This is a reversal.</strong> It
          cancels out {relatedLink ?? 'another transaction'} with the same
          entries on the opposite sides.
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <Panel
          title="Entries"
          meta={transaction.currency}
          className="grow-999 basis-115"
        >
          <TAccount
            debits={debits}
            credits={credits}
            currency={transaction.currency}
          />
        </Panel>

        <Panel className="grow basis-75">
          <dl className="num flex flex-col gap-4">
            <Detail label="External ID">
              <span className="font-mono">{transaction.externalId}</span>
            </Detail>
            <Detail label="Order">
              {order ? (
                <Link
                  href={`${path}/orders/${encodeURIComponent(order.id)}`}
                  className="font-mono"
                >
                  {order.externalId}
                </Link>
              ) : (
                'Not tied to an order'
              )}
            </Detail>
            <Detail label="Occurred">
              {formatDateTime(transaction.occurredAt)}
            </Detail>
            <Detail label="Recorded">
              {formatDateTime(transaction.createdAt)}
            </Detail>
            <Detail label="Currency">
              {transaction.exchangeRate
                ? `${transaction.currency} at ${transaction.exchangeRate} to base${transaction.rateSource ? ` (${transaction.rateSource})` : ''}`
                : `${transaction.currency}, no exchange rate needed`}
            </Detail>
            {transaction.description && (
              <Detail label="Description">{transaction.description}</Detail>
            )}
            <Detail label="Internal ID">
              <span className="font-mono text-small">{transaction.id}</span>
            </Detail>
          </dl>
        </Panel>
      </div>
    </>
  );
}
