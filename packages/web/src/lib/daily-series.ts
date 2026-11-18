import type { RevenueReport } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One value per day from `from`, `days` long, with 0 for days with no income
 * (the API leaves them out). Days are named in the service's timezone, as the
 * API names them. Numbers are fine here: they only size a chart.
 */
export function dailyValues(
  report: RevenueReport,
  from: string,
  days: number,
): number[] {
  const dayName = new Intl.DateTimeFormat('en-CA', {
    timeZone: report.timezone,
  });
  const byDay = new Map(
    report.series.map((point) => [point.day, Number(point.amount.amount)]),
  );
  const start = new Date(from).getTime();

  return Array.from(
    { length: days },
    (_, index) => byDay.get(dayName.format(start + index * DAY_MS)) ?? 0,
  );
}
