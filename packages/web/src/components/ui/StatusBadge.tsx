import { clsx } from 'clsx';

/** `duplicate` is the API's idempotent replay of a request already recorded. */
export type Status = 'posted' | 'pending' | 'reversed' | 'duplicate' | 'live';

const STATUS: Record<Status, { label: string; className: string }> = {
  posted: { label: 'Posted', className: 'bg-posted-wash text-posted' },
  pending: { label: 'Pending', className: 'bg-pending-wash text-pending' },
  reversed: { label: 'Reversed', className: 'bg-reversed-wash text-reversed' },
  duplicate: {
    label: 'Duplicate',
    className: 'bg-duplicate-wash text-duplicate',
  },
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
    case 'duplicate':
      return (
        <span className="text-caption leading-none" aria-hidden>
          =
        </span>
      );
    case 'live':
      return null;
  }
}

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: Status;
  size?: 'sm' | 'md';
}) {
  const { label, className } = STATUS[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-badge font-medium whitespace-nowrap',
        size === 'md' ? 'h-6.5 px-2.5 text-small' : 'h-5.5 px-2 text-caption',
        className,
      )}
    >
      <StatusMark status={status} />
      {label}
    </span>
  );
}
