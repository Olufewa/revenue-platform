'use client';

import { Fragment, useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ListFooter } from '@/components/ui/ListFooter';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatShortDateTime } from '@/lib/format-date';
import { transactionAmount, transactionStatus } from '@/lib/ledger';
import { formatMoney, sumMoney } from '@/lib/money';
import type { LedgerTransaction, Page } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/** How many transactions to ask for at a time. */
const PAGE_SIZE = 20;

/** One page of the ledger, newest first. */
async function loadTransactions(
  serviceId: string,
  cursor?: string,
): Promise<Page<LedgerTransaction>> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) query.set('cursor', cursor);

  const { transactions, nextCursor } = await api<{
    transactions: LedgerTransaction[];
    nextCursor: string | null;
  }>(`/services/${encodeURIComponent(serviceId)}/transactions?${query}`);

  return { items: transactions, nextCursor };
}

/**
 * Debit and credit totals for what's on screen, in the base currency so
 * transactions in different currencies can be added. Null if there are none.
 */
function totals(transactions: LedgerTransaction[]) {
  const entries = transactions.flatMap((transaction) => transaction.entries);
  if (entries.length === 0) return null;

  const base = entries[0].baseAmount.currency;
  const side = (direction: 'DEBIT' | 'CREDIT') =>
    sumMoney(
      entries
        .filter((entry) => entry.direction === direction)
        .map((entry) => entry.baseAmount),
      base,
    );

  const debit = side('DEBIT');
  const credit = side('CREDIT');
  if (!debit || !credit) return null;
  return { debit, credit, balanced: debit.amount === credit.amount };
}

export function TransactionsView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [showEntries, setShowEntries] = useState(true);
  const load = useCallback(
    (cursor?: string) => loadTransactions(serviceId, cursor),
    [serviceId],
  );
  const { items, hasMore, error, loading, loadingMore, loadMore, reload } =
    usePagedList(load);
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const sums = items ? totals(items) : null;

  return (
    <>
      <PageHeader
        title="Transactions"
        breadcrumb={<ServiceBreadcrumb serviceId={serviceId} />}
        actions={
          <>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showEntries}
                onChange={(event) => setShowEntries(event.target.checked)}
                className="size-4.5 accent-ink"
              />
              Show entries
            </label>
            <Button onClick={reload}>Refresh</Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && <p className="text-ink-2">Loading the ledger…</p>}

      {items?.length === 0 && (
        <EmptyState title="No transactions yet">
          <p>
            Transactions appear here once the service posts them with its API
            key.
          </p>
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <Panel flush title="Ledger" meta="Newest first">
          <Table>
            <thead>
              <tr>
                <Th>Occurred</Th>
                <Th>Transaction</Th>
                <Th>Order</Th>
                <Th numeric>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((transaction) => (
                <Fragment key={transaction.id}>
                  <tr className="border-t border-muted first:border-t-0">
                    <Td className="py-3 whitespace-nowrap text-ink-2">
                      {formatShortDateTime(transaction.occurredAt)}
                    </Td>
                    <Td className="py-3 font-mono text-small">
                      <Link
                        href={`${path}/transactions/${encodeURIComponent(transaction.id)}`}
                        className="wrap-anywhere"
                      >
                        {transaction.externalId}
                      </Link>
                    </Td>
                    <Td className="py-3 text-small">
                      {transaction.orderId ? (
                        <Link
                          href={`${path}/orders/${encodeURIComponent(transaction.orderId)}`}
                        >
                          View order
                        </Link>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td numeric className="py-3">
                      {formatMoney(transactionAmount(transaction))}
                    </Td>
                    <Td className="py-3">
                      <StatusBadge
                        size="sm"
                        status={transactionStatus(transaction)}
                      />
                    </Td>
                  </tr>
                  {showEntries &&
                    transaction.entries.map((entry) => (
                      <tr key={entry.id} className="bg-paper text-small">
                        <Td />
                        <Td className="pl-9 font-mono">{entry.accountCode}</Td>
                        <Td className="text-ink-2">
                          {entry.direction === 'DEBIT' ? 'Debit' : 'Credit'}
                        </Td>
                        <Td numeric>{formatMoney(entry.amount)}</Td>
                        <Td />
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </Table>
          <ListFooter
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          >
            {sums ? (
              <>
                Debits {formatMoney(sums.debit)} · Credits{' '}
                {formatMoney(sums.credit)} across {items.length} shown{' '}
                <span
                  className={`font-medium ${sums.balanced ? 'text-posted' : 'text-reversed'}`}
                >
                  {sums.balanced ? '✓ balanced' : '✕ out of balance'}
                </span>
              </>
            ) : (
              `Showing ${items.length}`
            )}
          </ListFooter>
        </Panel>
      )}
    </>
  );
}
