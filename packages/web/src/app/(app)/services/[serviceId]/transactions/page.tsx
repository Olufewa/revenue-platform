import type { Metadata } from 'next';
import { TransactionsView } from './TransactionsView';

export const metadata: Metadata = { title: 'Transactions' };

export default function TransactionsPage() {
  return <TransactionsView />;
}
