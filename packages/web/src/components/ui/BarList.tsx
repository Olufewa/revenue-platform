import { clsx } from 'clsx';

const SERIES = {
  1: 'bg-series-1',
  2: 'bg-series-2',
  3: 'bg-series-3',
  4: 'bg-series-4',
};

export interface Bar {
  label: string;
  value: number;
  /** The formatted value, labelled directly on the bar. */
  display: string;
  series: keyof typeof SERIES;
}

/** Horizontal bars on one scale, with direct labels instead of a legend. */
export function BarList({ bars }: { bars: Bar[] }) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);

  return (
    <div className="num flex flex-col gap-3 text-small">
      {bars.map((bar) => (
        <div
          key={bar.label}
          className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] items-center gap-3"
        >
          <span className="truncate">{bar.label}</span>
          <span className="block h-2.5 rounded-bar bg-muted">
            <span
              className={clsx('block h-2.5 rounded-bar', SERIES[bar.series])}
              style={{ width: `${max > 0 ? (bar.value / max) * 100 : 0}%` }}
            />
          </span>
          <span className="text-right">{bar.display}</span>
        </div>
      ))}
    </div>
  );
}
