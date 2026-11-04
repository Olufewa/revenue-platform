import { clsx } from 'clsx';

export function BrandMark({ inverse }: { inverse?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex size-5.5 items-center justify-center rounded-badge bg-gold text-caption font-bold text-ink">
        ₦
      </span>
      <span
        className={clsx(
          'text-[0.9375rem] font-semibold tracking-[-0.01em]',
          inverse ? 'text-surface' : 'text-ink',
        )}
      >
        Revenue Platform
      </span>
    </span>
  );
}
