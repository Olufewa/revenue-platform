import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { formatMoney } from '@/lib/money';

export interface Leg {
  account: string;
  /** Whole minor units, as the API returns them. */
  amount: string;
}

interface TAccountProps {
  debits: Leg[];
  credits: Leg[];
  currency: string;
  /** Shown after the balance check, such as the order the transaction is for. */
  note?: ReactNode;
  /** For use on an ink background. */
  inverse?: boolean;
  /** Hides the totals and balance check, for decorative use. */
  legsOnly?: boolean;
}

const sum = (legs: Leg[]) =>
  legs.reduce((total, leg) => total + BigInt(leg.amount), 0n);

function LegRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 wrap-anywhere">{label}</span>
      <span>{amount}</span>
    </div>
  );
}

/**
 * Both sides of a transaction. The balance check comes from the amounts, so
 * this can't show "Balanced" for legs that don't add up.
 */
export function TAccount({
  debits,
  credits,
  currency,
  note,
  inverse,
  legsOnly,
}: TAccountProps) {
  const format = (amount: string) =>
    formatMoney({ amount, currency }, { symbol: false });
  const debitTotal = sum(debits);
  const creditTotal = sum(credits);
  const balanced = debitTotal === creditTotal;

  const heading = clsx(
    'text-caption font-medium tracking-[0.06em]',
    inverse ? 'text-on-ink-3' : 'text-ink-2',
  );
  const rule = inverse ? 'border-surface' : 'border-ink';

  return (
    <div className="num flex flex-col gap-3 text-body">
      <div className={clsx('grid grid-cols-2 border-t-2', rule)}>
        <div className={clsx('flex flex-col gap-2 border-r-2 py-3 pr-4', rule)}>
          <div className={heading}>DEBIT</div>
          {debits.map((leg) => (
            <LegRow
              key={leg.account}
              label={leg.account}
              amount={format(leg.amount)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 py-3 pl-4">
          <div className={heading}>CREDIT</div>
          {credits.map((leg) => (
            <LegRow
              key={leg.account}
              label={leg.account}
              amount={format(leg.amount)}
            />
          ))}
        </div>
      </div>

      {!legsOnly && (
        <>
          <div className="grid grid-cols-2 border-t border-line pt-2.5 font-semibold">
            <div className="pr-4">
              <LegRow label="Total" amount={format(debitTotal.toString())} />
            </div>
            <div className="pl-4">
              <LegRow label="Total" amount={format(creditTotal.toString())} />
            </div>
          </div>
          <div
            className={clsx(
              'flex items-center gap-2 text-small font-medium',
              balanced ? 'text-posted' : 'text-reversed',
            )}
          >
            <span aria-hidden>{balanced ? '✓' : '✕'}</span>
            <span>
              {balanced ? 'Balanced' : 'Out of balance'} · {currency}
              {note && <> · {note}</>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
