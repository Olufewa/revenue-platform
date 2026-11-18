import type { Metadata } from 'next';
import { AccountsView } from './AccountsView';

export const metadata: Metadata = { title: 'Accounts' };

export default function AccountsPage() {
  return <AccountsView />;
}
