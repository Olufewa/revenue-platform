'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { ACCOUNT_TYPES, CODE_PATTERN, TYPE_HINTS } from '@/lib/accounts';
import { api } from '@/lib/api';
import type { AccountType } from '@/lib/types';
import { describeError } from '@/lib/use-api';

/** The side panel from the mood board: add one account to the chart. */
export function AddAccountForm({
  serviceId,
  onAdded,
}: {
  serviceId: string;
  onAdded: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Keep the form: `event.currentTarget` is gone after the first `await`.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const code = String(form.get('code')).trim();
    const name = String(form.get('name')).trim();
    const type = String(form.get('type')) as AccountType;

    setAdded(null);
    if (!CODE_PATTERN.test(code)) {
      setError('Use lowercase letters, digits and single underscores.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await api(`/services/${encodeURIComponent(serviceId)}/accounts`, {
        method: 'POST',
        body: { code, name, type },
      });
      formElement.reset();
      setAdded(code);
      onAdded();
    } catch (failure) {
      // A 409 says 'Account "refunds" already exists': the server's words are clear.
      setError(describeError(failure));
    }
    setPending(false);
  }

  return (
    <form
      aria-label="Add account"
      onSubmit={submit}
      className="flex min-w-0 flex-[1_1_18rem] flex-col gap-4 rounded-panel border border-line bg-surface p-6"
    >
      <h2 className="text-panel-title">Add account</h2>
      <Field
        label="Code"
        name="code"
        required
        maxLength={40}
        placeholder="refunds"
        className="font-mono"
        hint="Lowercase letters, digits and single underscores. Can't be changed later."
      />
      <Field
        label="Name"
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="Refunds paid"
      />
      <SelectField label="Type" name="type" defaultValue="EXPENSE">
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type} · {TYPE_HINTS[type]}
          </option>
        ))}
      </SelectField>

      {error && (
        <p
          role="alert"
          className="rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {error}
        </p>
      )}
      {added && (
        <p role="status" className="text-small font-medium text-posted">
          ✓ Added <span className="font-mono">{added}</span>
        </p>
      )}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Adding…' : 'Add account'}
      </Button>
      <p className="text-small text-ink-2">
        Accounts can&apos;t be deleted, only archived, so old reports keep
        adding up. An archived account takes no new entries, so archive one only
        when your service has stopped posting to it.
      </p>
    </form>
  );
}
