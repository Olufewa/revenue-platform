import type { Metadata } from 'next';
import { BrandMark } from '@/components/layout/BrandMark';
import { TAccount } from '@/components/ui/TAccount';
import { safeNext } from '@/lib/safe-next';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-wrap">
      <section
        aria-label="About the platform"
        className="flex min-w-0 flex-[1_1_480px] flex-col gap-10 bg-ink px-6 py-12 text-surface md:px-14"
      >
        <BrandMark inverse />
        <div className="flex max-w-130 grow flex-col justify-center gap-5">
          <h1 className="text-[clamp(2.25rem,6vw,3.25rem)] leading-[1.04] font-semibold tracking-[-0.035em]">
            Every naira,
            <br />
            accounted for.
          </h1>
          <p className="text-base leading-relaxed text-on-ink-2">
            Product teams send their orders and ledger entries. The platform
            keeps the books balanced and turns them into revenue reports, per
            service and across MTN.
          </p>
        </div>
        <div className="max-w-105">
          <TAccount
            inverse
            legsOnly
            currency="NGN"
            debits={[{ account: 'cash', amount: '107500' }]}
            credits={[
              { account: 'vat_payable', amount: '7500' },
              { account: 'revenue', amount: '100000' },
            ]}
          />
        </div>
        <div className="text-small text-on-ink-3">
          Internal tool for MTN product teams
        </div>
      </section>

      <main className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-6 py-12">
        <SignInForm next={safeNext(next)} />
      </main>
    </div>
  );
}
