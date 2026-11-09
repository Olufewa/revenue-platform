import type { DateRange } from '@/stores/workspace';

/** How each range reads in a sentence, such as "Revenue, month to date". */
export const RANGE_LABELS: Record<DateRange, string> = {
  Today: 'today',
  '7D': 'last 7 days',
  '30D': 'last 30 days',
  MTD: 'month to date',
};

/**
 * Where a date range starts, as the ISO timestamp the API takes as `from`.
 * Days start at midnight on this browser's clock. The end is left to the API,
 * which defaults to now.
 */
export function rangeStart(range: DateRange, now = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case 'Today':
      break;
    case '7D':
      start.setDate(start.getDate() - 6);
      break;
    case '30D':
      start.setDate(start.getDate() - 29);
      break;
    case 'MTD':
      start.setDate(1);
      break;
  }

  return start.toISOString();
}
