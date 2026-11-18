import { clsx } from 'clsx';

/**
 * `duplicate` is the API's idempotent replay of a request already recorded.
 * `reversal` is the mirror-image transaction that cancels another one out.
 * `revoked` is an API key that no longer works.
 */
export type Status =
  | 'posted'
  | 'pending'
  | 'reversed'
  | 'reversal'
  | 'duplicate'
  | 'revoked'
  | 'live';

const STATUS: Record<Status, { label: string; className: string }> = {
  posted: { label: 'Posted', className: 'bg-posted-wash text-posted' },
  pending: { label: 'Pending', className: 'bg-pending-wash text-pending' },
  reversed: { label: 'Reversed', className: 'bg-reversed-wash text-reversed' },
  reversal: {
    label: 'Reversal',
    className: 'bg-duplicate-wash text-duplicate',
  },
  duplicate: {
    label: 'Duplicate',
    className: 'bg-duplicate-wash text-duplicate',
  },
  revoked: { label: 'Revoked', className: 'bg-muted text-ink-3' },
  live: { label: 'LIVE', className: 'bg-ink text-surface tracking-[0.04em]' },
};

/** Every status pairs a shape or symbol with its colour. */
function StatusMark({ status }: { status: Status }) {
  switch (status) {
    case 'posted':
      return <span className="size-1.75 rounded-full bg-current" aria-hidden />;
    case 'pending':
      return (
        <span
          className="size-1.75 rounded-full border-[1.5px] border-dashed border-current"
          aria-hidden
        />
      );
    case 'reversed':
      return (
        <span className="text-caption leading-none" aria-hidden>
          ↺
        </span>
      );
    case 'reversal':
      return (
        <span className="text-caption leading-none" aria-hidden>
          ⇄
        </span>
      );
    case 'duplicate':
      return (
        <span className="text-caption leading-none" aria-hidden>
          =
        </span>
      );
    case 'revoked':
      return (
        <span className="text-caption leading-none" aria-hidden>
          ⊘
        </span>
      );
    case 'live':
      return null;
  }
}

export function StatusBadge({
  status,
  size = 'md',
  label,
}: {
  status: Status;
  size?: 'sm' | 'md';
  /** Replaces the usual word, such as "Fully recognised" for an order. */
  label?: string;
}) {
  const { className } = STATUS[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-badge font-medium whitespace-nowrap',
        size === 'md' ? 'h-6.5 px-2.5 text-small' : 'h-5.5 px-2 text-caption',
        className,
      )}
    >
      <StatusMark status={status} />
      {label ?? STATUS[status].label}
    </span>
  );
}
