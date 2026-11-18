'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SecretCallout } from '@/components/ui/SecretCallout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { CreatedApiKey, LedgerTransaction, Order } from '@/lib/types';
import { describeError, useApi } from '@/lib/use-api';

/** How often to check for the first order, in milliseconds. */
const POLL_MS = 3000;

interface FirstOrder {
  order: Order | null;
  entryCount: number;
}

/** The newest order on the service, and how many entries it has so far. */
async function loadFirstOrder(serviceId: string): Promise<FirstOrder> {
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const { orders } = await api<{ orders: Order[] }>(`${path}/orders?limit=1`);
  const order = orders[0] ?? null;
  if (!order) return { order: null, entryCount: 0 };

  const transactions = await api<LedgerTransaction[]>(
    `${path}/orders/${encodeURIComponent(order.id)}/transactions`,
  );
  const entryCount = transactions.reduce(
    (count, transaction) => count + transaction.entries.length,
    0,
  );
  return { order, entryCount };
}

/** The two requests from the mood board, filled in with this key. */
function sampleRequests(key: string, externalId: string, at: string) {
  return `# Point your terminal at the API and this service's key
export API_URL="http://localhost:3003"
export REVENUE_API_KEY="${key}"

# 1. Record the sale. Copy "id" from the reply's "order".
curl -X POST "$API_URL/orders" \\
  -H "x-api-key: $REVENUE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "${externalId}",
    "amount": 537500,
    "currency": "NGN",
    "placedAt": "${at}"
  }'

export ORDER_ID="paste-the-order-id-here"

# 2. Post the balanced entries for that order
curl -X POST "$API_URL/orders/$ORDER_ID/transactions" \\
  -H "x-api-key: $REVENUE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "${externalId}-purchase",
    "occurredAt": "${at}",
    "entries": [
      { "accountCode": "cash",             "direction": "DEBIT",  "amount": 537500 },
      { "accountCode": "vat_payable",      "direction": "CREDIT", "amount": 37500 },
      { "accountCode": "deferred_revenue", "direction": "CREDIT", "amount": 500000 }
    ]
  }'`;
}

export function ConnectSteps() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [created, setCreated] = useState<{
    key: string;
    externalId: string;
    at: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const load = useCallback(() => loadFirstOrder(serviceId), [serviceId]);
  const { data, error } = useApi(load, POLL_MS);
  const order = data?.order ?? null;
  const received = order !== null && data !== null && data.entryCount > 0;

  // A button, not on page load: development mode runs effects twice, and a
  // refresh would mint another key. Each click makes exactly one.
  async function createKey() {
    setCreating(true);
    setKeyError(null);
    try {
      const { key } = await api<CreatedApiKey>(
        `/services/${encodeURIComponent(serviceId)}/keys`,
        { method: 'POST', body: { name: 'production' } },
      );
      setCreated({
        key,
        externalId: `first-order-${Date.now()}`,
        at: new Date().toISOString(),
      });
    } catch (failure) {
      setKeyError(describeError(failure));
    }
    setCreating(false);
  }

  return (
    <div className="flex max-w-230 flex-col gap-6">
      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-section">1. Your API key</h2>
          <span className="text-caption text-ink-2">
            Key name: <span className="font-mono text-ink">production</span>
          </span>
        </div>
        {created ? (
          <SecretCallout secret={created.key} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={received ? 'outline' : 'primary'}
              onClick={createKey}
              disabled={creating}
            >
              {creating ? 'Creating key…' : 'Create API key'}
            </Button>
            <span className="text-small text-ink-2">
              The full key is shown once, right after it&apos;s created.
            </span>
          </div>
        )}
        {keyError && (
          <p
            role="alert"
            className="rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
          >
            {keyError}
          </p>
        )}
        <span className="text-caption text-ink-2">
          Store it as <span className="font-mono">REVENUE_API_KEY</span> in your
          service&apos;s environment. Never put it in front-end code or a repo.
        </span>
      </Panel>

      <Panel>
        <h2 className="text-section">
          2. Send your first order and its entries
        </h2>
        {created ? (
          <pre className="overflow-x-auto rounded-control bg-ink px-5 py-4.5 font-mono text-small leading-relaxed text-surface">
            {sampleRequests(created.key, created.externalId, created.at)}
          </pre>
        ) : (
          <p className="text-ink-2">
            Create the key first. The requests to copy appear here, filled in
            with it.
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-small text-ink-body">
          <span>
            Amounts are whole kobo: <span className="font-mono">537500</span> =
            ₦5,375.00
          </span>
          <span>
            Same <span className="font-mono">externalId</span> + same body =
            safe retry
          </span>
          <span>Debits must equal credits</span>
        </div>
      </Panel>

      <section
        aria-label="Connection status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-surface px-6 py-5"
      >
        {received ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <StatusBadge status="posted" />
                <span className="text-[0.9375rem] font-medium">
                  First order received and balanced
                </span>
              </div>
              <span className="num text-small text-ink-2">
                <span className="font-mono">{order.externalId}</span> ·{' '}
                {formatMoney(order.total)} · {data.entryCount} entries ·{' '}
                {new Date(order.placedAt).toLocaleTimeString('en-GB')}
              </span>
            </div>
            <Link
              href={`/services/${encodeURIComponent(serviceId)}/overview`}
              className={buttonStyles({ variant: 'primary' })}
            >
              Go to the overview
            </Link>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <StatusBadge status="pending" />
              <span className="text-[0.9375rem] font-medium">
                {order
                  ? 'Order received. Waiting for its entries…'
                  : 'Waiting for your first order…'}
              </span>
            </div>
            <span className="text-small text-ink-2">
              {error ?? 'This updates on its own when the request arrives.'}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
