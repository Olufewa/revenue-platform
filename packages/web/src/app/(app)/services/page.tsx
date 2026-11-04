import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonStyles } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Services' };

export default function ServicesPage() {
  return (
    <>
      <PageHeader title="All services" />
      <EmptyState title="Not built yet">
        <p>
          This page will list your services from the API. Until then, open the
          placeholder service to walk through the service pages.
        </p>
        <Link href="/services/sample/overview" className={buttonStyles()}>
          Open placeholder service
        </Link>
      </EmptyState>
    </>
  );
}
