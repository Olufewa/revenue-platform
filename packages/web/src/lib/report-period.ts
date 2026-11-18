/** The periods the Reports page offers. */
export const PERIODS = [
  'Month to date',
  'Last month',
  'Quarter to date',
  'Custom',
] as const;
export type Period = (typeof PERIODS)[number];

/** A stretch of time: `from` included, `to` not, as ISO timestamps. */
export interface DateWindow {
  from: string;
  to: string;
}

/** Custom dates as the date inputs give them: `2026-11-01`. Both days included. */
export interface CustomDates {
  from: string;
  to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Both custom days are filled in, and the end isn't before the start. */
export function customDatesReady({ from, to }: CustomDates): boolean {
  // `YYYY-MM-DD` text sorts the same way the days do.
  return from !== '' && to !== '' && to >= from;
}

/** Midnight at the start of a `YYYY-MM-DD` day on this browser's clock. */
function startOfDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/**
 * The same moment a number of months earlier (negative) or later. The day is
 * kept where it can be: 31 Mar minus one month is 28 Feb, not 3 Mar.
 */
export function shiftMonths(date: Date, months: number): Date {
  const shifted = new Date(date);
  shifted.setDate(1);
  shifted.setMonth(shifted.getMonth() + months);
  const lastDay = new Date(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    0,
  ).getDate();
  shifted.setDate(Math.min(date.getDate(), lastDay));
  return shifted;
}

/**
 * The window a period covers. Days start at midnight on this browser's
 * clock, as on the Overview. Returns null for Custom until both dates are
 * filled in and the end isn't before the start.
 */
export function periodWindow(
  period: Period,
  now: Date,
  custom?: CustomDates,
): DateWindow | null {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (period) {
    case 'Month to date':
      return { from: monthStart.toISOString(), to: now.toISOString() };
    case 'Last month':
      return {
        from: shiftMonths(monthStart, -1).toISOString(),
        to: monthStart.toISOString(),
      };
    case 'Quarter to date': {
      const quarterStart = new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3,
        1,
      );
      return { from: quarterStart.toISOString(), to: now.toISOString() };
    }
    case 'Custom': {
      if (!custom || !customDatesReady(custom)) return null;
      const from = startOfDay(custom.from);
      // The end day is included, so the window runs to the next midnight.
      const to = new Date(startOfDay(custom.to).getTime() + DAY_MS);
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }
}

/**
 * The window to compare with. The presets move back by the same number of
 * calendar months (1–18 Nov against 1–18 Oct, a quarter against the one
 * before). A custom window compares with the same number of days just before it.
 */
export function previousWindow(period: Period, window: DateWindow): DateWindow {
  const from = new Date(window.from);
  const to = new Date(window.to);

  if (period === 'Custom') {
    const length = to.getTime() - from.getTime();
    return {
      from: new Date(from.getTime() - length).toISOString(),
      to: window.from,
    };
  }

  const months = period === 'Quarter to date' ? 3 : 1;
  return {
    from: shiftMonths(from, -months).toISOString(),
    to: shiftMonths(to, -months).toISOString(),
  };
}

/** How many days a window touches, at least 1. */
export function dayCount(window: DateWindow): number {
  const length =
    new Date(window.to).getTime() - new Date(window.from).getTime();
  return Math.max(1, Math.ceil(length / DAY_MS));
}

/** `1–18 Nov 2026`, or `28 Oct – 3 Nov 2026` across months. */
export function formatWindow(window: DateWindow): string {
  const from = new Date(window.from);
  // `to` isn't included, so the last day shown is the moment before it.
  const last = new Date(new Date(window.to).getTime() - 1);
  const day = (date: Date, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString('en-GB', options);

  if (from.toDateString() === last.toDateString()) {
    return day(from, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (
    from.getMonth() === last.getMonth() &&
    from.getFullYear() === last.getFullYear()
  ) {
    return `${from.getDate()}–${day(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (from.getFullYear() === last.getFullYear()) {
    return `${day(from, { day: 'numeric', month: 'short' })} – ${day(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return `${day(from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${day(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
