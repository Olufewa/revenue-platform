import type { Metadata } from 'next';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <ServicePagePlaceholder
      title="Orders"
      description="Orders sent by this service, with a summary of each."
    />
  );
}
