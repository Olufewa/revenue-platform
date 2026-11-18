import { clsx } from 'clsx';

interface ColumnChartProps {
  /** One value per column, oldest first. */
  values: number[];
  /** A column to pick out in gold, such as today. */
  highlight?: number;
  /** What the chart shows, for screen readers. */
  label: string;
}

/** Vertical bars on one scale, drawn with plain divs: one per day. */
export function ColumnChart({ values, highlight, label }: ColumnChartProps) {
  const max = Math.max(...values, 0);

  return (
    <div
      role="img"
      aria-label={label}
      className={clsx(
        'flex h-40 items-end border-b border-line-strong',
        values.length > 40 ? 'gap-px' : 'gap-1.5',
      )}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className={clsx(
            'min-w-0 flex-1 rounded-t-bar',
            index === highlight ? 'bg-series-3' : 'bg-series-1',
          )}
          // A day with no income still gets a hairline, so the gap is visible.
          style={{
            height: max > 0 && value > 0 ? `${(value / max) * 100}%` : '1px',
          }}
        />
      ))}
    </div>
  );
}
