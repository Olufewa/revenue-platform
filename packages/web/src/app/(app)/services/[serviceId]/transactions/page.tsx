import type { Metadata } from 'next';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'Transactions' };

export default function TransactionsPage() {
  return (
    <ServicePagePlaceholder
      title="Transactions"
      description="The ledger for this service, showing both legs of every transaction."
    />
  );
}
