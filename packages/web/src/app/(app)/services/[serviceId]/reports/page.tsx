import type { Metadata } from 'next';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <ServicePagePlaceholder
      title="Reports"
      description="Revenue, income statement, balance sheet and cash flow."
    />
  );
}
