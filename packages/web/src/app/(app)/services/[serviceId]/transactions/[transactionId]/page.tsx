import type { Metadata } from 'next';
import { TransactionDetailView } from './TransactionDetailView';

export const metadata: Metadata = { title: 'Transaction' };

export default function TransactionDetailPage() {
  return <TransactionDetailView />;
}
