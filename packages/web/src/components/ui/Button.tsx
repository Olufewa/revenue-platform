import type { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'ink' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Gold is for the one primary action per screen.
  primary:
    'border-gold bg-gold text-ink hover:border-gold-hover hover:bg-gold-hover hover:text-ink',
  ink: 'border-ink bg-ink text-surface hover:border-ink-body hover:bg-ink-body hover:text-surface',
  outline: 'border-line bg-surface text-ink hover:bg-paper hover:text-ink',
  // Destructive actions sit away from copy and confirm.
  danger:
    'border-danger-line bg-surface text-reversed hover:bg-reversed-wash hover:text-reversed',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7.5 rounded-badge px-2.5 text-caption',
  md: 'h-control rounded-control px-4 text-body',
  lg: 'h-11 rounded-control px-4.5 text-[0.9375rem]',
};

/** The button look, for applying to a Next.js `Link`. */
export function buttonStyles({
  variant = 'outline',
  size = 'md',
}: { variant?: Variant; size?: Size } = {}) {
  return clsx(
    'inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap no-underline disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(buttonStyles({ variant, size }), className)}
      {...props}
    />
  );
}
