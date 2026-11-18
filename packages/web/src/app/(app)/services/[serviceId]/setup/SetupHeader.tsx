'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { WizardSteps } from '@/components/layout/WizardSteps';
import { api } from '@/lib/api';
import type { Service } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** The heading and steps for wizard steps 2 and 3, named after the service. */
export function SetupHeader({ title, step }: { title: string; step: 2 | 3 }) {
  const { serviceId } = useParams<{ serviceId: string }>();
  const load = useCallback(
    () => api<Service>(`/services/${encodeURIComponent(serviceId)}`),
    [serviceId],
  );
  const { data: service } = useApi(load);

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={
          <>
            <Link href="/services" className="text-ink-2">
              Services
            </Link>{' '}
            / New service{service && ` · ${service.name}`}
          </>
        }
      />
      <WizardSteps current={step} />
    </>
  );
}
