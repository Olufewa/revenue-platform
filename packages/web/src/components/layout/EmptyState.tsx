import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/Panel';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel className="items-start">
      <h2 className="text-panel-title">{title}</h2>
      <div className="flex max-w-prose flex-col items-start gap-4 text-ink-body">
        {children}
      </div>
    </Panel>
  );
}
