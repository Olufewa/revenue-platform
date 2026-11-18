'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { Table, Td, Th } from '@/components/ui/Table';
import { TYPE_HEADINGS } from '@/lib/accounts';
import { api } from '@/lib/api';
import { formatMoney, type Money } from '@/lib/money';
import type { Account, AccountType, Balances } from '@/lib/types';
import { describeError, useApi } from '@/lib/use-api';
import { AddAccountForm } from './AddAccountForm';

/** The mood board's order: what you hold, what you owe, then the flows. */
const SECTION_ORDER: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'INCOME',
  'EXPENSE',
  'EQUITY',
];

interface AccountsData {
  accounts: Account[];
  /** Each account's balance by code, from the balances report. */
  balances: Map<string, Money>;
  currency: string;
}

/** The chart of accounts and every balance: two requests at once. */
async function loadAccounts(serviceId: string): Promise<AccountsData> {
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const [accounts, balances] = await Promise.all([
    api<Account[]>(`${path}/accounts`),
    api<Balances>(`${path}/balances`),
  ]);

  return {
    accounts,
    balances: new Map(
      balances.accounts.map((row) => [row.accountCode, row.balance]),
    ),
    currency: balances.baseCurrency,
  };
}

export function AccountsView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const load = useCallback(() => loadAccounts(serviceId), [serviceId]);
  const { data, error, loading, reload } = useApi(load);
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount =
    data?.accounts.filter((account) => account.archived).length ?? 0;

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        breadcrumb={<ServiceBreadcrumb serviceId={serviceId} />}
        actions={
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="size-4.5 accent-ink"
            />
            Show archived{archivedCount > 0 && ` (${archivedCount})`}
          </label>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && <p className="text-ink-2">Loading accounts…</p>}

      <div className="flex flex-wrap items-start gap-6">
        {data && (
          <AccountsTable
            data={data}
            serviceId={serviceId}
            showArchived={showArchived}
            onChanged={reload}
          />
        )}
        <AddAccountForm serviceId={serviceId} onAdded={reload} />
      </div>
    </>
  );
}

function AccountsTable({
  data,
  serviceId,
  showArchived,
  onChanged,
}: {
  data: AccountsData;
  serviceId: string;
  showArchived: boolean;
  onChanged: () => void;
}) {
  // Only one row is renamed at a time, so one code and one draft are enough.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = data.accounts.filter(
    (account) => showArchived || !account.archived,
  );

  /** Sends a change for one account, then reloads the list. */
  async function update(
    code: string,
    body: { name?: string; archived?: boolean },
  ) {
    setBusy(code);
    setActionError(null);
    try {
      await api(
        `/services/${encodeURIComponent(serviceId)}/accounts/${encodeURIComponent(code)}`,
        { method: 'PATCH', body },
      );
      setEditing(null);
      onChanged();
    } catch (failure) {
      setActionError(`Couldn't change ${code}: ${describeError(failure)}`);
    }
    setBusy(null);
  }

  function startRename(account: Account) {
    setEditing(account.code);
    setDraft(account.name);
    setActionError(null);
  }

  function saveRename(code: string) {
    const name = draft.trim();
    if (name.length < 2) {
      setActionError('A name needs at least 2 characters.');
      return;
    }
    void update(code, { name });
  }

  return (
    <section
      aria-label="Accounts"
      className="min-w-0 flex-[999_1_40rem] overflow-hidden rounded-panel border border-line bg-surface"
    >
      {actionError && (
        <p
          role="alert"
          className="m-4 rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {actionError}
        </p>
      )}
      <Table className="min-w-[40rem]">
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th numeric>Balance ({data.currency})</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {SECTION_ORDER.map((type) => {
            const accounts = visible.filter((account) => account.type === type);
            // Equity always shows, for the note about retained earnings.
            if (accounts.length === 0 && type !== 'EQUITY') return null;

            return (
              <SectionRows key={type} title={TYPE_HEADINGS[type]}>
                {accounts.map((account) => {
                  const isEditing = editing === account.code;
                  const isBusy = busy === account.code;
                  const balance = data.balances.get(account.code);

                  return (
                    <tr
                      key={account.code}
                      className={clsx(
                        'border-b border-muted',
                        account.archived && 'text-ink-3',
                      )}
                    >
                      <Td
                        className={clsx(
                          'py-3 font-mono text-small wrap-anywhere',
                          account.archived && 'line-through',
                        )}
                      >
                        {account.code}
                      </Td>
                      <Td className="py-2">
                        {isEditing ? (
                          <Input
                            aria-label={`New name for ${account.code}`}
                            value={draft}
                            maxLength={80}
                            autoFocus
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter')
                                saveRename(account.code);
                              if (event.key === 'Escape') setEditing(null);
                            }}
                          />
                        ) : (
                          <>
                            {account.name}
                            {account.archived && (
                              <span className="ml-1.5 rounded-badge border border-line px-1.5 py-px text-caption">
                                Archived
                              </span>
                            )}
                          </>
                        )}
                      </Td>
                      <Td numeric className="py-3">
                        {balance
                          ? formatMoney(balance, { symbol: false })
                          : '—'}
                      </Td>
                      <Td className="py-2">
                        <div className="flex justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ink"
                                disabled={isBusy}
                                onClick={() => saveRename(account.code)}
                              >
                                {isBusy ? 'Saving…' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : account.archived ? (
                            <Button
                              size="sm"
                              disabled={isBusy}
                              onClick={() =>
                                update(account.code, { archived: false })
                              }
                            >
                              {isBusy ? 'Restoring…' : 'Restore'}
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() => startRename(account)}
                              >
                                Rename
                              </Button>
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() =>
                                  update(account.code, { archived: true })
                                }
                              >
                                {isBusy ? 'Archiving…' : 'Archive'}
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {type === 'EQUITY' && (
                  <tr className="border-b border-muted last:border-b-0">
                    <Td colSpan={4} className="py-3 text-small text-ink-2">
                      Retained earnings is worked out for the balance sheet. You
                      don&apos;t post to it.
                    </Td>
                  </tr>
                )}
              </SectionRows>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}

/** A grey heading row across the table, then that type's rows. */
function SectionRows({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-muted bg-paper">
        <td
          colSpan={4}
          className="px-5 py-2.25 text-caption font-semibold tracking-[0.06em] uppercase"
        >
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
