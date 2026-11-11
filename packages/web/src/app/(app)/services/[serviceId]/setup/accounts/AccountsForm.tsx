'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api';
import type { AccountType } from '@/lib/types';
import { describeError } from '@/lib/use-api';

interface AccountChoice {
  code: string;
  name: string;
  type: AccountType;
  selected: boolean;
}

/** A starter set for a prepaid data product. Refunds is off by default. */
const STARTER: AccountChoice[] = [
  { code: 'cash', name: 'Cash received', type: 'ASSET', selected: true },
  {
    code: 'vat_payable',
    name: 'VAT payable',
    type: 'LIABILITY',
    selected: true,
  },
  {
    code: 'deferred_revenue',
    name: 'Unused pool balance',
    type: 'LIABILITY',
    selected: true,
  },
  {
    code: 'bundle_revenue',
    name: 'Data pool revenue',
    type: 'INCOME',
    selected: true,
  },
  { code: 'refunds', name: 'Refunds paid', type: 'EXPENSE', selected: false },
];

const ACCOUNT_TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
];

/** The same rule the API checks: lowercase, digits, single underscores. */
const CODE_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export function AccountsForm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const router = useRouter();
  const [choices, setChoices] = useState<AccountChoice[]>(STARTER);
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = choices.filter((choice) => choice.selected);

  function toggle(code: string) {
    setChoices((current) =>
      current.map((choice) =>
        choice.code === code
          ? { ...choice, selected: !choice.selected }
          : choice,
      ),
    );
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code')).trim();
    const name = String(form.get('name')).trim();
    const type = String(form.get('type')) as AccountType;

    if (!CODE_PATTERN.test(code)) {
      setAddError('Use lowercase letters, digits and single underscores.');
      return;
    }
    if (choices.some((choice) => choice.code === code)) {
      setAddError(`There is already an account called ${code}.`);
      return;
    }

    setChoices((current) => [...current, { code, name, type, selected: true }]);
    setAddError(null);
    event.currentTarget.reset();
  }

  async function createAccounts() {
    setPending(true);
    setError(null);
    const path = `/services/${encodeURIComponent(serviceId)}`;

    try {
      // One at a time, so a failure says exactly which account it was.
      for (const { code, name, type } of selected) {
        try {
          await api(`${path}/accounts`, {
            method: 'POST',
            body: { code, name, type },
          });
        } catch (failure) {
          // 409: it already exists, from an earlier try. That's fine.
          if (failure instanceof ApiError && failure.status === 409) continue;
          throw new Error(`Couldn't create ${code}: ${describeError(failure)}`);
        }
      }
      router.push(`${path}/setup/connect`);
    } catch (failure) {
      setPending(false);
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  return (
    <div className="max-w-190 min-w-0 flex-[1_1_520px] overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex flex-col gap-1.5 border-b border-line px-5 pt-6 pb-4">
        <h2 className="text-section">Chart of accounts</h2>
        <p className="text-ink-2">
          We picked a starter set for a prepaid data product. Untick what you
          don&apos;t need.
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Accounts to create</legend>
        {choices.map((choice) => (
          <label
            key={choice.code}
            className="grid cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.4fr)_5.5rem] items-center gap-3 border-b border-muted px-5 py-3.5"
          >
            <input
              type="checkbox"
              checked={choice.selected}
              onChange={() => toggle(choice.code)}
              className="size-4.5 accent-ink"
            />
            <span className="font-mono wrap-anywhere">{choice.code}</span>
            <span>{choice.name}</span>
            <span className="text-right text-[0.6875rem] font-medium tracking-[0.06em] text-ink-2">
              {choice.type}
            </span>
          </label>
        ))}
      </fieldset>

      <form
        onSubmit={addAccount}
        className="flex flex-col gap-2.5 border-b border-line bg-paper px-5 py-4.5"
      >
        <div className="text-small font-medium">Add your own</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] items-end gap-2.5">
          <Field
            label="Code"
            name="code"
            required
            maxLength={40}
            placeholder="promo_discounts"
            className="font-mono"
          />
          <Field
            label="Name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Promotional discounts"
          />
          <SelectField label="Type" name="type" defaultValue="EXPENSE">
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </SelectField>
          <Button type="submit">Add</Button>
        </div>
        <span
          className={
            addError ? 'text-caption text-reversed' : 'text-caption text-ink-2'
          }
          role={addError ? 'alert' : undefined}
        >
          {addError ??
            "Codes use lowercase letters, digits and single underscores. Your service sends them on every entry, so they can't change later. Names can."}
        </span>
      </form>

      {error && (
        <p
          role="alert"
          className="mx-5 mt-4 rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4.5">
        <span className="text-caption text-ink-2">
          {selected.length === 1
            ? '1 account will be created'
            : `${selected.length} accounts will be created`}
        </span>
        <Button
          variant="primary"
          onClick={createAccounts}
          disabled={pending || selected.length === 0}
        >
          {pending ? 'Creating accounts…' : 'Create accounts and continue'}
        </Button>
      </div>
    </div>
  );
}
