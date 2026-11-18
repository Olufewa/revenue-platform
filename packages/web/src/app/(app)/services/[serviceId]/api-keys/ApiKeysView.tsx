'use client';

import { Fragment, useCallback, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { SecretCallout } from '@/components/ui/SecretCallout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, Td, Th } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatAgo, formatDate } from '@/lib/format-date';
import type { ApiKey, CreatedApiKey } from '@/lib/types';
import { describeError, useApi } from '@/lib/use-api';

interface KeysData {
  keys: ApiKey[];
  /** When the list arrived, for "4 min ago". Read here, not while rendering. */
  loadedAt: Date;
}

/** Every key on the service, newest first (the server's order). */
async function loadKeys(serviceId: string): Promise<KeysData> {
  const keys = await api<ApiKey[]>(
    `/services/${encodeURIComponent(serviceId)}/keys`,
  );
  return { keys, loadedAt: new Date() };
}

export function ApiKeysView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const load = useCallback(() => loadKeys(serviceId), [serviceId]);
  const { data, error, loading, reload } = useApi(load);

  return (
    <>
      <PageHeader
        title="API keys"
        breadcrumb={<ServiceBreadcrumb serviceId={serviceId} />}
      />
      <p className="-mt-3 max-w-160 text-ink-2">
        Your service sends orders and entries with one of these keys in the{' '}
        <span className="font-mono text-ink">x-api-key</span> header. Use one
        key per app or environment so you can revoke them separately.
      </p>

      <CreateKey serviceId={serviceId} onCreated={reload} />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && <p className="text-ink-2">Loading keys…</p>}
      {data && (
        <KeysTable data={data} serviceId={serviceId} onRevoked={reload} />
      )}

      <p className="text-small text-ink-2">
        Only a hash of each key is stored, so a lost key can&apos;t be shown
        again. Create a new one, switch your app over, then revoke the old one.
      </p>
    </>
  );
}

function CreateKey({
  serviceId,
  onCreated,
}: {
  serviceId: string;
  onCreated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const name = String(new FormData(formElement).get('name')).trim();

    setPending(true);
    setError(null);
    try {
      const created = await api<CreatedApiKey>(
        `/services/${encodeURIComponent(serviceId)}/keys`,
        { method: 'POST', body: { name } },
      );
      // The only time the full key exists outside your app: show it now.
      setSecret(created.key);
      formElement.reset();
      onCreated();
    } catch (failure) {
      setError(describeError(failure));
    }
    setPending(false);
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="key-name" className="font-medium">
          New key
        </label>
        <Input
          id="key-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="ussd-gateway"
          className="max-w-80 flex-[1_1_14rem]"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create key'}
        </Button>
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {error}
        </p>
      )}
      {/* `key` makes a fresh callout per key, so "Copied" doesn't carry over. */}
      {secret && <SecretCallout key={secret} secret={secret} />}
    </Panel>
  );
}

function KeysTable({
  data,
  serviceId,
  onRevoked,
}: {
  data: KeysData;
  serviceId: string;
  onRevoked: () => void;
}) {
  // The key waiting for "Are you sure?", and the one being revoked right now.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function revoke(key: ApiKey) {
    setRevoking(key.id);
    setRevokeError(null);
    try {
      await api(
        `/services/${encodeURIComponent(serviceId)}/keys/${encodeURIComponent(key.id)}`,
        { method: 'DELETE' },
      );
      setConfirming(null);
      onRevoked();
    } catch (failure) {
      setRevokeError(`Couldn't revoke ${key.name}: ${describeError(failure)}`);
    }
    setRevoking(null);
  }

  if (data.keys.length === 0) {
    return (
      <Panel>
        <p className="text-ink-2">
          No keys yet. Create one above, then send it with every request.
        </p>
      </Panel>
    );
  }

  return (
    <Panel flush>
      {revokeError && (
        <p
          role="alert"
          className="m-4 rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {revokeError}
        </p>
      )}
      <Table className="min-w-[46rem]">
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Key</Th>
            <Th>Created</Th>
            <Th>Last used</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.keys.map((key) => (
            // Two rows per key: the key, and its "Are you sure?" when asked.
            <Fragment key={key.id}>
              <tr className="border-b border-muted">
                <Td className="py-3 font-medium">{key.name}</Td>
                <Td className="py-3 font-mono text-small">{key.prefix}…</Td>
                <Td className="py-3 text-ink-2">{formatDate(key.createdAt)}</Td>
                <Td className="py-3 text-ink-2">
                  {key.lastUsedAt
                    ? formatAgo(key.lastUsedAt, data.loadedAt)
                    : 'Never'}
                </Td>
                <Td className="py-3">
                  {key.active ? (
                    <StatusBadge size="sm" status="posted" label="Active" />
                  ) : (
                    <StatusBadge size="sm" status="revoked" />
                  )}
                </Td>
                <Td className="py-2 text-right">
                  {key.active && confirming !== key.id && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirming(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </Td>
              </tr>
              {confirming === key.id && (
                <tr className="border-b border-danger-line bg-reversed-wash">
                  <td colSpan={6} className="px-5 py-3.5">
                    <div
                      role="alertdialog"
                      aria-label={`Revoke ${key.name}`}
                      className="flex flex-wrap items-center justify-between gap-3 text-reversed"
                    >
                      <span>
                        Revoke <span className="font-mono">{key.name}</span>?
                        Anything still using it stops sending data straight
                        away. This can&apos;t be undone.
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={revoking === key.id}
                          onClick={() => revoke(key)}
                        >
                          {revoking === key.id ? 'Revoking…' : 'Revoke key'}
                        </Button>
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>
      <p className="border-t border-line px-5 py-3 text-caption text-ink-2">
        &ldquo;Last used&rdquo; is saved at most every 5 minutes, so a busy key
        can read a few minutes behind.
      </p>
    </Panel>
  );
}
