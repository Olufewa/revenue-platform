'use client';

import { useEffect, useState } from 'react';
import { ApiError } from './api';

/** The same wording the sign-in form uses. */
export function describeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "We can't reach the server right now. Try again soon.";
}

/**
 * Loads data for a client component. Pass a function wrapped in `useCallback`:
 * the data loads again whenever that function changes, and every `pollMs`
 * milliseconds if set. Old data stays on screen while new data loads.
 */
export function useApi<T>(load: () => Promise<T>, pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      try {
        const result = await load();
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (failure) {
        if (cancelled) return;
        setError(describeError(failure));
      }
      if (!cancelled && pollMs) timer = setTimeout(run, pollMs);
    }

    void run();

    // Runs when the component goes away or before loading again, so a slow
    // old request can't overwrite newer data.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, pollMs, attempt]);

  return {
    data,
    error,
    loading: data === null && error === null,
    reload: () => setAttempt((count) => count + 1),
  };
}
