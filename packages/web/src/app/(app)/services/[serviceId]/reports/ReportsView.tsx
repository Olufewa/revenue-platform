'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceBreadcrumb } from '@/components/layout/ServiceBreadcrumb';
import type { CustomDates, Period } from '@/lib/report-period';
import { BalanceSheetTab } from './BalanceSheetTab';
import { CashFlowTab } from './CashFlowTab';
import { IncomeStatementTab } from './IncomeStatementTab';

const TABS = [
  { id: 'income-statement', label: 'Income statement' },
  { id: 'balance-sheet', label: 'Balance sheet' },
  { id: 'cash-flow', label: 'Cash flow' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** The tab named in `?tab=`, or the income statement. */
function tabFrom(value: string | null): TabId {
  return TABS.find((tab) => tab.id === value)?.id ?? 'income-statement';
}

export function ReportsView() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const pathname = usePathname();
  const tab = tabFrom(useSearchParams().get('tab'));

  // Kept here, above the tabs, so the period survives switching between the
  // income statement and the cash flow.
  const [period, setPeriod] = useState<Period>('Month to date');
  const [custom, setCustom] = useState<CustomDates>({ from: '', to: '' });
  const periodProps = { period, setPeriod, custom, setCustom };

  return (
    <>
      <PageHeader
        title="Reports"
        breadcrumb={<ServiceBreadcrumb serviceId={serviceId} />}
      />

      <nav
        aria-label="Report"
        className="flex flex-wrap gap-x-7 border-b border-line"
      >
        {TABS.map(({ id, label }) => (
          <Link
            key={id}
            href={`${pathname}?tab=${id}`}
            aria-current={tab === id ? 'page' : undefined}
            className={clsx(
              '-mb-px inline-flex h-11 items-center border-b-2 no-underline',
              tab === id
                ? 'border-ink font-semibold text-ink'
                : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'income-statement' && (
        <IncomeStatementTab serviceId={serviceId} {...periodProps} />
      )}
      {tab === 'balance-sheet' && <BalanceSheetTab serviceId={serviceId} />}
      {tab === 'cash-flow' && (
        <CashFlowTab serviceId={serviceId} {...periodProps} />
      )}
    </>
  );
}
