import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { formatMoney, type Money } from '@/lib/money';

/*
 * The building blocks the balance sheet and cash flow share: a grey section
 * heading, a row with a label and an amount, and the ✓ line at the bottom.
 * Amounts leave out the symbol, because the panel names the currency.
 */

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-muted bg-paper px-6 py-2.5 text-caption font-semibold tracking-[0.06em] uppercase">
      {children}
    </div>
  );
}

const ROW_STYLES = {
  line: 'border-b border-muted py-2.75',
  total: 'border-b border-muted py-2.75 font-semibold',
  grand: 'border-t-2 border-ink py-4 text-panel-title font-semibold',
};

export function StatementRow({
  label,
  amount,
  kind = 'line',
  muted,
}: {
  label: ReactNode;
  amount: Money;
  /** `total` for a section's total, `grand` for the bottom line. */
  kind?: keyof typeof ROW_STYLES;
  /** Greys the row out, for "nothing here" lines. */
  muted?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex justify-between gap-4 px-6',
        ROW_STYLES[kind],
        muted && 'text-ink-2',
      )}
    >
      <span className="min-w-0 wrap-anywhere">{label}</span>
      <span className="text-right whitespace-nowrap">
        {formatMoney(amount, { symbol: false })}
      </span>
    </div>
  );
}

/** `vat_payable · VAT payable`: the code people send, then its name. */
export function AccountLabel({ code, name }: { code: string; name: string }) {
  return (
    <>
      <span className="font-mono text-small">{code}</span>{' '}
      <span className="text-ink-2">· {name}</span>
    </>
  );
}

/** The proof line: green with ✓ when it holds, red with ✕ when it doesn't. */
export function CheckLine({
  ok,
  okText,
  failText,
}: {
  ok: boolean;
  okText: string;
  failText: string;
}) {
  return (
    <div
      className={clsx(
        'px-6 pt-2 pb-5 text-small font-medium',
        ok ? 'text-posted' : 'text-reversed',
      )}
    >
      {ok ? '✓' : '✕'} {ok ? okText : failText}
    </div>
  );
}

/** The panel the balance sheet and cash flow sit in. */
export function StatementPanel({
  title,
  meta,
  label,
  children,
}: {
  title: ReactNode;
  meta: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="num max-w-2xl overflow-hidden rounded-panel border border-line bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pt-5 pb-3.5">
        <h2 className="text-panel-title">{title}</h2>
        <span className="text-small text-ink-2">{meta}</span>
      </div>
      {children}
    </section>
  );
}
