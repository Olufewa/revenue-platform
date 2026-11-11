import type { SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  controlSize?: 'md' | 'lg';
}

/** A dropdown with the same look as Input. */
export function Select({
  controlSize = 'md',
  className,
  ...props
}: SelectProps) {
  return (
    <select
      className={clsx(
        'w-full rounded-control border border-line-strong bg-surface px-3 text-ink',
        controlSize === 'lg' ? 'h-11 text-[0.9375rem]' : 'h-control text-body',
        className,
      )}
      {...props}
    />
  );
}
