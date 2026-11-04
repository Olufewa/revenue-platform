'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ApiError } from '@/lib/api';
import { createAccount, signIn } from '@/lib/session';

const SIGN_IN = 'Sign in';
const REGISTER = 'Create account';

function describeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We can't reach the server right now. Try again soon.";
}

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<string>(SIGN_IN);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registering = mode === REGISTER;

  function changeMode(newMode: string) {
    setMode(newMode);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));

    setPending(true);
    setError(null);

    let created = false;
    try {
      if (registering) {
        await createAccount({
          name: String(form.get('name')),
          email,
          password,
        });
        created = true;
      }
      await signIn({ email, password });
      // A full navigation, so no cached page from before sign-in is reused.
      window.location.assign(next);
    } catch (failure) {
      setPending(false);
      if (created) {
        setMode(SIGN_IN);
        setError(
          `Your account was created, but we couldn't sign you in. ${describeError(failure)}`,
        );
      } else {
        setError(describeError(failure));
      }
    }
  }

  const pendingLabel = registering ? 'Creating account…' : 'Signing in…';

  return (
    <div className="flex w-full max-w-100 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
          {registering ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-ink-2">
          {registering
            ? 'One account can own several services.'
            : 'Sign in to see your services and their books.'}
        </p>
      </div>

      <SegmentedControl
        fullWidth
        label="Sign in or create account"
        options={[SIGN_IN, REGISTER]}
        value={mode}
        onChange={changeMode}
      />

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {registering && (
          <Field
            controlSize="lg"
            label="Full name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
          />
        )}
        <Field
          controlSize="lg"
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          controlSize="lg"
          label="Password"
          name="password"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          required
          minLength={registering ? 8 : undefined}
          hint={registering ? 'At least 8 characters.' : undefined}
        />
        {error && (
          <p
            role="alert"
            className="rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          className="mt-2 w-full"
        >
          {pending ? pendingLabel : mode}
        </Button>
      </form>

      <p className="text-small text-ink-2">
        Sessions use a short-lived token. Product services never sign in here:
        they send data with an API key instead.
      </p>
    </div>
  );
}
