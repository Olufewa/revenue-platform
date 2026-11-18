'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';
import type { Service } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * A service's name, loaded by its ID: `…` while it loads, and the ID itself
 * if it can't be found (a service deleted since it was last opened).
 */
export function ServiceName({ serviceId }: { serviceId: string }) {
  const load = useCallback(
    () => api<Service>(`/services/${encodeURIComponent(serviceId)}`),
    [serviceId],
  );
  const { data, error } = useApi(load);

  return <>{data?.name ?? (error ? serviceId : '…')}</>;
}
