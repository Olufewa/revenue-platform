import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {breadcrumb && (
          <div className="text-small wrap-anywhere text-ink-2">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-display">{title}</h1>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}
