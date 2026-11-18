import type { Metadata } from 'next';
import { OrderDetailView } from './OrderDetailView';

export const metadata: Metadata = { title: 'Order' };

export default function OrderDetailPage() {
  return <OrderDetailView />;
}
