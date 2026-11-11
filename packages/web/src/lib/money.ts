/** Money as the API returns it: whole minor units (kobo, cents) as a string. */
export interface Money {
  amount: string;
  currency: string;
}

const LOCALE = 'en-NG';

function fractionDigits(currency: string): number {
  return (
    new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/**
 * Converts minor units to a decimal string using BigInt, because amounts can
 * exceed what a JavaScript number holds exactly. Intl formats the string as is.
 */
function toDecimal({ amount, currency }: Money): Intl.StringNumericLiteral {
  const minor = BigInt(amount);
  const digits = fractionDigits(currency);
  const unsigned = (minor < 0n ? -minor : minor)
    .toString()
    .padStart(digits + 1, '0');
  const split = unsigned.length - digits;
  const fraction = digits > 0 ? `.${unsigned.slice(split)}` : '';

  return `${minor < 0n ? '-' : ''}${unsigned.slice(0, split)}${fraction}` as Intl.StringNumericLiteral;
}

/**
 * Full precision, for tables and detail views: `₦3,500.00`. Pass
 * `symbol: false` when a column header already names the currency: `3,500.00`.
 */
export function formatMoney(
  money: Money,
  { symbol = true }: { symbol?: boolean } = {},
): string {
  const digits = fractionDigits(money.currency);
  const format = new Intl.NumberFormat(
    LOCALE,
    symbol
      ? {
          style: 'currency',
          currency: money.currency,
          currencyDisplay: 'narrowSymbol',
        }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );

  return format.format(toDecimal(money));
}

/** Three significant figures, for stat tiles: `₦48.2M`. */
export function formatCompact(money: Money): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumSignificantDigits: 3,
  }).format(toDecimal(money));
}

/**
 * Adds amounts in BigInt, so nothing is lost to floating point. Returns null
 * when the amounts are in different currencies, because they can't be added.
 */
export function sumMoney(values: Money[], currency: string): Money | null {
  if (values.some((value) => value.currency !== currency)) return null;

  const total = values.reduce((sum, value) => sum + BigInt(value.amount), 0n);
  return { amount: total.toString(), currency };
}
