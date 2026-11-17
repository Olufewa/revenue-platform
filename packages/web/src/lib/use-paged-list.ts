'use client';

import { useEffect, useState } from 'react';
import type { Page } from './types';
import { describeError } from './use-api';

/**
 * Loads a list one page at a time. Pass a function wrapped in `useCallback`
 * that fetches the page after `cursor`, or the first page when there's none.
 * `loadMore` adds the next page to the end; `reload` starts again from the top.
 */
export function usePagedList<T>(
  loadPage: (cursor?: string) => Promise<Page<T>>,
) {
  const [items, setItems] = useState<T[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The first page: again whenever `loadPage` changes or `reload` is called.
  useEffect(() => {
    let cancelled = false;

    loadPage()
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(describeError(failure));
      });

    return () => {
      cancelled = true;
    };
  }, [loadPage, attempt]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(nextCursor);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    items,
    hasMore: nextCursor !== null,
    error,
    loading: items === null && error === null,
    loadingMore,
    loadMore,
    reload: () => setAttempt((count) => count + 1),
  };
}
