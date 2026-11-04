import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  controlSize?: 'md' | 'lg';
}

export function Input({ controlSize = 'md', className, ...props }: InputProps) {
  return (
    <input
      className={clsx(
        'w-full rounded-control border border-line-strong bg-surface px-3 text-ink aria-invalid:border-reversed',
        controlSize === 'lg' ? 'h-11 text-[0.9375rem]' : 'h-control text-body',
        className,
      )}
      {...props}
    />
  );
}
