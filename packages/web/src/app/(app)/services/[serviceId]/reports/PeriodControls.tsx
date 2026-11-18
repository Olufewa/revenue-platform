'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PERIODS, type CustomDates, type Period } from '@/lib/report-period';

/** What the tabs that cover a period get from ReportsView. */
export interface PeriodProps {
  period: Period;
  setPeriod: (period: Period) => void;
  custom: CustomDates;
  setCustom: (custom: CustomDates) => void;
}

/**
 * The period buttons, the two dates for Custom, and a line saying exactly
 * which days are shown. `summary` is filled in once the report has loaded.
 */
export function PeriodControls({
  period,
  setPeriod,
  custom,
  setCustom,
  summary,
  onRefresh,
}: PeriodProps & { summary?: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SegmentedControl
          label="Period"
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />
        <div className="flex flex-wrap items-center gap-3">
          {summary && (
            <span className="num text-small text-ink-2">{summary}</span>
          )}
          <Button size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      {period === 'Custom' && (
        <div className="flex flex-wrap items-center gap-2.5 text-small">
          <label htmlFor="period-from" className="font-medium">
            From
          </label>
          <div className="w-44">
            <Input
              id="period-from"
              type="date"
              value={custom.from}
              onChange={(event) =>
                setCustom({ ...custom, from: event.target.value })
              }
              className="num"
            />
          </div>
          <label htmlFor="period-to" className="font-medium">
            to
          </label>
          <div className="w-44">
            <Input
              id="period-to"
              type="date"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(event) =>
                setCustom({ ...custom, to: event.target.value })
              }
              className="num"
            />
          </div>
          <span className="text-caption text-ink-2">Both days included</span>
        </div>
      )}
    </div>
  );
}
