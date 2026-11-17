'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ListFooter } from '@/components/ui/ListFooter';
import { Panel } from '@/components/ui/Panel';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatShortDateTime } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';
import type { Order, Page } from '@/lib/types';
import { usePagedList } from '@/lib/use-paged-list';

/** How many orders to ask for at a time. */
const PAGE_SIZE = 20;

/** One page of orders, newest first. */
async function loadOrders(
  serviceId: string,
  cursor?: string,
): Promise<Page<Order>> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) query.set('cursor', cursor);

  const { orders, nextCursor } = await api<{
    orders: Order[];
    nextCursor: string | null;
  }>(`/services/${encodeURIComponent(serviceId)}/orders?${query}`);

  return { items: orders, nextCursor };
}

/** The sales channel, if the product team sent one in the metadata. */
function channelOf(order: Order): string {
  const channel = order.metadata?.channel;
  return typeof channel === 'string' ? channel.toUpperCase() : '—';
}

export function OrdersView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const load = useCallback(
    (cursor?: string) => loadOrders(serviceId, cursor),
    [serviceId],
  );
  const { items, hasMore, error, loading, loadingMore, loadMore, reload } =
    usePagedList(load);

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumb={<ServiceBreadcrumb serviceId={serviceId} />}
        actions={<Button onClick={reload}>Refresh</Button>}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {loading && <p className="text-ink-2">Loading orders…</p>}

      {items?.length === 0 && (
        <EmptyState title="No orders yet">
          <p>
            Orders appear here once the service sends them with its API key.
            Start <code className="font-mono">npm run sim:traffic</code> to send
            some.
          </p>
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <Panel flush title="Orders" meta="Newest first">
          <Table>
            <thead>
              <tr>
                <Th>Placed</Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Channel</Th>
                <Th>Description</Th>
                <Th numeric>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-muted last:border-b-0"
                >
                  <Td className="py-3 whitespace-nowrap text-ink-2">
                    {formatShortDateTime(order.placedAt)}
                  </Td>
                  <Td className="py-3 font-mono text-small">
                    <Link
                      href={`/services/${encodeURIComponent(serviceId)}/orders/${encodeURIComponent(order.id)}`}
                      className="wrap-anywhere"
                    >
                      {order.externalId}
                    </Link>
                  </Td>
                  <Td className="py-3 font-mono text-small text-ink-2">
                    {order.customerRef ?? '—'}
                  </Td>
                  <Td className="py-3">{channelOf(order)}</Td>
                  <Td className="py-3">{order.description ?? '—'}</Td>
                  <Td numeric className="py-3">
                    {formatMoney(order.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ListFooter
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          >
            Showing {items.length} {items.length === 1 ? 'order' : 'orders'}
          </ListFooter>
        </Panel>
      )}
    </>
  );
}
