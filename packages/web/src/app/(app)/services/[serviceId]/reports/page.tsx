import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ReportsView } from './ReportsView';

export const metadata: Metadata = { title: 'Reports' };

/**
 * The view reads `?tab=` from the address bar. Next.js asks for a Suspense
 * boundary around anything that does, so the rest of the page can be built
 * ahead of time.
 */
export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
