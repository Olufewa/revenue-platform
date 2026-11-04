import type { Metadata } from 'next';
import { ServicePagePlaceholder } from '@/components/layout/ServicePagePlaceholder';

export const metadata: Metadata = { title: 'API keys' };

export default function ApiKeysPage() {
  return (
    <ServicePagePlaceholder
      title="API keys"
      description="Create, list and revoke the keys this service sends data with."
    />
  );
}
