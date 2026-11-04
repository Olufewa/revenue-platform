'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';

interface ServicePagePlaceholderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

/** Stands in for a service screen until it is built. */
export function ServicePagePlaceholder({
  title,
  description,
  actions,
}: ServicePagePlaceholderProps) {
  const { serviceId } = useParams<{ serviceId: string }>();

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={
          <>
            <Link href="/services" className="text-ink-2 no-underline">
              Services
            </Link>{' '}
            / <span className="font-mono text-ink">{serviceId}</span>
          </>
        }
        actions={actions}
      />
      <EmptyState title="Not built yet">
        <p>{description}</p>
      </EmptyState>
    </>
  );
}
