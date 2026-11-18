import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { WizardSteps } from '@/components/layout/WizardSteps';
import { NewServiceForm } from './NewServiceForm';

export const metadata: Metadata = { title: 'New service' };

const NEXT_STEPS = [
  {
    step: 2,
    title: 'Accounts.',
    text: 'Pick the ledger accounts your service posts to, like cash, VAT payable and revenue.',
  },
  {
    step: 3,
    title: 'Connect.',
    text: 'Get an API key and send your first order. The page waits for it to arrive.',
  },
];

export default function NewServicePage() {
  return (
    <>
      <PageHeader
        title="Register a service"
        breadcrumb={
          <>
            <Link href="/services" className="text-ink-2">
              Services
            </Link>{' '}
            / New service
          </>
        }
      />
      <WizardSteps current={1} />

      <div className="flex flex-wrap items-start gap-6">
        <NewServiceForm />

        <aside
          aria-label="What happens next"
          className="flex max-w-90 flex-[1_1_260px] flex-col gap-4 pt-1"
        >
          <div className="label">What happens next</div>
          {NEXT_STEPS.map(({ step, title, text }) => (
            <div key={step} className="flex gap-3">
              <span className="font-mono text-small text-ink-2">{step}</span>
              <p className="text-ink-body">
                <strong className="font-semibold text-ink">{title}</strong>{' '}
                {text}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
