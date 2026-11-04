import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface PanelProps {
  title?: string;
  /** Short context or a link, shown opposite the title. */
  meta?: ReactNode;
  /** Removes the padding so a table can run edge to edge. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, meta, flush, className, children }: PanelProps) {
  const header = title && (
    <div
      className={clsx(
        'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
        flush && 'border-b border-line px-5 py-4',
      )}
    >
      <h2 className="text-panel-title">{title}</h2>
      {meta && <div className="text-small text-ink-2">{meta}</div>}
    </div>
  );

  return (
    <section
      className={clsx(
        'min-w-0 rounded-panel border border-line bg-surface',
        flush ? 'overflow-hidden' : 'flex flex-col gap-4 p-6',
        className,
      )}
    >
      {header}
      {children}
    </section>
  );
}
