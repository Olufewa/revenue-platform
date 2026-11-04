import type { ReactNode } from 'react';

const TONES = {
  positive: 'font-medium text-posted',
  negative: 'font-medium text-reversed',
};

interface StatTileProps {
  label: string;
  value: string;
  /** The movement, such as `▲ 12.4%`. The tone is set by whether it is good. */
  change?: string;
  tone?: keyof typeof TONES;
  note?: string;
}

export function StatTile({ label, value, change, tone, note }: StatTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-surface p-6">
      <div className="label">{label}</div>
      <div className="num text-figure">{value}</div>
      {(change || note) && (
        <div className="text-small text-ink-2">
          {change && (
            <span className={tone ? TONES[tone] : undefined}>{change} </span>
          )}
          {note}
        </div>
      )}
    </div>
  );
}

/** Tiles in one panel. Gaps over the panel background draw the hairlines. */
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}
