import { describe, expect, it } from 'vitest';
import { rangeStart } from './date-range';

// 9 Nov 2026, 3:30 pm on this machine's clock.
const now = new Date(2026, 10, 9, 15, 30);
const midnight = (month: number, day: number) =>
  new Date(2026, month, day).toISOString();

describe('rangeStart', () => {
  it('starts today at midnight', () => {
    expect(rangeStart('Today', now)).toBe(midnight(10, 9));
  });

  it('counts today as one of the last 7 and 30 days', () => {
    expect(rangeStart('7D', now)).toBe(midnight(10, 3));
    expect(rangeStart('30D', now)).toBe(midnight(9, 11));
  });

  it('starts month to date on the 1st', () => {
    expect(rangeStart('MTD', now)).toBe(midnight(10, 1));
  });
});
