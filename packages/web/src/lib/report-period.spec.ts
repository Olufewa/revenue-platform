import { describe, expect, it } from 'vitest';
import {
  formatWindow,
  periodWindow,
  previousWindow,
  shiftMonths,
} from './report-period';

// 18 Nov 2026, 2:30 pm on this machine's clock.
const now = new Date(2026, 10, 18, 14, 30);
const at = (month: number, day: number, hour = 0, minute = 0) =>
  new Date(2026, month, day, hour, minute).toISOString();

describe('periodWindow', () => {
  it('runs month to date from the 1st until now', () => {
    expect(periodWindow('Month to date', now)).toEqual({
      from: at(10, 1),
      to: now.toISOString(),
    });
  });

  it('covers the whole of last month', () => {
    expect(periodWindow('Last month', now)).toEqual({
      from: at(9, 1),
      to: at(10, 1),
    });
  });

  it('starts the quarter on 1 Oct', () => {
    expect(periodWindow('Quarter to date', now)?.from).toBe(at(9, 1));
  });

  it('includes both custom days, and waits for both', () => {
    expect(
      periodWindow('Custom', now, { from: '2026-11-03', to: '2026-11-05' }),
    ).toEqual({ from: at(10, 3), to: at(10, 6) });
    expect(periodWindow('Custom', now, { from: '2026-11-03', to: '' })).toBe(
      null,
    );
    expect(
      periodWindow('Custom', now, { from: '2026-11-05', to: '2026-11-03' }),
    ).toBe(null);
  });
});

describe('previousWindow', () => {
  it('compares month to date with the same days last month', () => {
    const window = periodWindow('Month to date', now)!;
    expect(previousWindow('Month to date', window)).toEqual({
      from: at(9, 1),
      to: at(9, 18, 14, 30),
    });
  });

  it('compares a custom window with the days just before it', () => {
    const window = { from: at(10, 3), to: at(10, 6) };
    expect(previousWindow('Custom', window)).toEqual({
      from: at(9, 31),
      to: at(10, 3),
    });
  });
});

describe('shiftMonths', () => {
  it('keeps the day inside a shorter month', () => {
    expect(shiftMonths(new Date(2026, 2, 31), -1)).toEqual(
      new Date(2026, 1, 28),
    );
  });
});

describe('formatWindow', () => {
  it('writes a window inside one month briefly', () => {
    expect(formatWindow({ from: at(10, 1), to: now.toISOString() })).toBe(
      '1–18 Nov 2026',
    );
  });

  it('names both months across a month end', () => {
    expect(formatWindow({ from: at(9, 28), to: at(10, 4) })).toBe(
      '28 Oct – 3 Nov 2026',
    );
  });
});
