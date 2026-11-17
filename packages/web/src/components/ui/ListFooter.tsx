import type { ReactNode } from 'react';
import { Button } from './Button';

interface ListFooterProps {
  /** What's on screen, such as "Showing 40 orders". */
  children: ReactNode;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/** The strip under a paged table: a summary on the left, Load more on the right. */
export function ListFooter({
  children,
  hasMore,
  loadingMore,
  onLoadMore,
}: ListFooterProps) {
  return (
    <div className="num flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-small text-ink-2">
      <span>{children}</span>
      {hasMore ? (
        <Button size="sm" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      ) : (
        <span>That&apos;s everything</span>
      )}
    </div>
  );
}
