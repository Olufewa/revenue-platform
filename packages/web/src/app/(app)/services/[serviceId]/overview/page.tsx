import type { Metadata } from 'next';
import { DateRangeControl } from '@/components/layout/DateRangeControl';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return (
    <ServicePagePlaceholder
      title="Overview"
      description="Revenue, balances and recent transactions for this service."
      actions={<DateRangeControl />}
    />
  );
}
