import type { Metadata } from 'next';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'Accounts' };

export default function AccountsPage() {
  return (
    <ServicePagePlaceholder
      title="Accounts"
      description="The chart of accounts for this service."
    />
  );
}
