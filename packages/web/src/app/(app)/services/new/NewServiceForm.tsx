'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Field, SelectField } from '@/components/ui/Field';
import { api } from '@/lib/api';
import type { Service } from '@/lib/types';
import { describeError } from '@/lib/use-api';

const CURRENCIES = [
  { code: 'NGN', label: 'NGN · Nigerian naira' },
  { code: 'USD', label: 'USD · US dollar' },
  { code: 'GHS', label: 'GHS · Ghanaian cedi' },
];

const TIMEZONES = [
  { zone: 'Africa/Lagos', label: 'Africa/Lagos (UTC+01:00)' },
  { zone: 'Africa/Accra', label: 'Africa/Accra (UTC+00:00)' },
  { zone: 'UTC', label: 'UTC' },
];

export function NewServiceForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);

    try {
      const service = await api<Service>('/services', {
        method: 'POST',
        body: {
          name: String(form.get('name')).trim(),
          baseCurrency: String(form.get('baseCurrency')),
          timezone: String(form.get('timezone')),
        },
      });
      router.push(`/services/${encodeURIComponent(service.id)}/setup/accounts`);
    } catch (failure) {
      setPending(false);
      setError(describeError(failure));
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex max-w-190 min-w-0 flex-[1_1_440px] flex-col gap-5.5 rounded-panel border border-line bg-surface p-7"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-section">What are you tracking?</h2>
        <p className="text-ink-2">
          One service per product that earns money. You can register more later.
        </p>
      </div>

      <Field
        label="Service name"
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="MTN Family Data Pool"
        hint="Shown on reports and the services list."
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(13.75rem,1fr))] gap-5">
        <SelectField
          label="Base currency"
          name="baseCurrency"
          defaultValue="NGN"
          hint="Every report is in this currency. Entries in another currency need an exchange rate."
        >
          {CURRENCIES.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Timezone"
          name="timezone"
          defaultValue="Africa/Lagos"
          hint="Daily totals cut off at midnight in this timezone."
        >
          {TIMEZONES.map(({ zone, label }) => (
            <option key={zone} value={zone}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-5">
        <Link href="/services" className={buttonStyles()}>
          Cancel
        </Link>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating service…' : 'Continue to accounts'}
        </Button>
      </div>
    </form>
  );
}
