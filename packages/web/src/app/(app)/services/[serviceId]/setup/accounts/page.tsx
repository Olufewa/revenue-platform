import type { Metadata } from 'next';
import { Panel } from '@/components/ui/Panel';
import { TAccount } from '@/components/ui/TAccount';
import { SetupHeader } from '../SetupHeader';
import { AccountsForm } from './AccountsForm';

export const metadata: Metadata = { title: 'Set up accounts' };

export default function SetupAccountsPage() {
  return (
    <>
      <SetupHeader title="Set up the accounts" step={2} />

      <div className="flex flex-wrap items-start gap-6">
        <AccountsForm />

        <Panel
          title="How they work together"
          className="max-w-105 flex-[1_1_300px]"
        >
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">A family buys a 20GB pool</h3>
            <TAccount
              currency="NGN"
              debits={[{ account: 'cash', amount: '537500' }]}
              credits={[
                { account: 'vat_payable', amount: '37500' },
                { account: 'deferred_revenue', amount: '500000' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">A member uses 4GB of it</h3>
            <TAccount
              currency="NGN"
              debits={[{ account: 'deferred_revenue', amount: '100000' }]}
              credits={[{ account: 'bundle_revenue', amount: '100000' }]}
            />
          </div>
          <p className="text-small text-ink-2">
            Money paid for data not yet used stays a liability. It only becomes
            revenue when it&apos;s used.
          </p>
        </Panel>
      </div>
    </>
  );
}
