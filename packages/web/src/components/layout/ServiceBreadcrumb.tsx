'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Service } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * `Services / MTN Data Bundles / …` above a service page. It loads the
 * service's name itself, so each page doesn't have to.
 */
export function ServiceBreadcrumb({
  serviceId,
  children,
}: {
  serviceId: string;
  /** Anything after the service name, such as a link back to the list. */
  children?: ReactNode;
}) {
  const path = `/services/${encodeURIComponent(serviceId)}`;
  const load = useCallback(() => api<Service>(path), [path]);
  const { data: service } = useApi(load);

  return (
    <>
      <Link href="/services" className="text-ink-2">
        Services
      </Link>{' '}
      /{' '}
      <Link href={`${path}/overview`} className="text-ink-2">
        {service?.name ?? '…'}
      </Link>
      {children && <> / {children}</>}
    </>
  );
}
