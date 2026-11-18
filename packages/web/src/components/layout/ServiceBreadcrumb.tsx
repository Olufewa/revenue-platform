'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ServiceName } from './ServiceName';

/** `Services / MTN Data Bundles / …` above a service page. */
export function ServiceBreadcrumb({
  serviceId,
  children,
}: {
  serviceId: string;
  /** Anything after the service name, such as a link back to the list. */
  children?: ReactNode;
}) {
  return (
    <>
      <Link href="/services" className="text-ink-2">
        Services
      </Link>{' '}
      /{' '}
      <Link
        href={`/services/${encodeURIComponent(serviceId)}/overview`}
        className="text-ink-2"
      >
        <ServiceName serviceId={serviceId} />
      </Link>
      {children && <> / {children}</>}
    </>
  );
}
