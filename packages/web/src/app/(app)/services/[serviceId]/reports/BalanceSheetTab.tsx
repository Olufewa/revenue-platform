'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format-date';
import type { BalanceSheet, StatementSection } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import {
  AccountLabel,
  CheckLine,
  SectionHeading,
  StatementPanel,
  StatementRow,
} from './statement';

/**
 * The balance sheet at a moment. `asOf` is what the date-and-time input
 * gives (`2026-11-18T10:30`, on this browser's clock), or empty for now.
 */
async function loadBalanceSheet(serviceId: string, asOf: string) {
  const path = `/services/${encodeURIComponent(serviceId)}/reports/balance-sheet`;
  const query = asOf
    ? `?${new URLSearchParams({ asOf: new Date(asOf).toISOString() })}`
    : '';
  return api<BalanceSheet>(`${path}${query}`);
}

export function BalanceSheetTab({ serviceId }: { serviceId: string }) {
  const [asOf, setAsOf] = useState('');
  const load = useCallback(
    () => loadBalanceSheet(serviceId, asOf),
    [serviceId, asOf],
  );
  const { data, error, loading, reload } = useApi(load);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="as-of" className="text-small font-medium">
            As of
          </label>
          <div className="w-60">
            <Input
              id="as-of"
              type="datetime-local"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              className="num"
            />
          </div>
          {asOf && (
            <Button size="sm" onClick={() => setAsOf('')}>
              Back to now
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <span className="num text-small text-ink-2">
              Showing {formatDateTime(data.asOf)}
            </span>
          )}
          <Button size="sm" onClick={reload}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && <p className="text-ink-2">Loading the balance sheet…</p>}
      {data && <BalanceSheetPanel sheet={data} />}
    </>
  );
}

/** One section's lines and total, or a grey "none yet" line. */
function Section({
  title,
  section,
}: {
  title: string;
  section: StatementSection;
}) {
  return (
    <>
      <SectionHeading>{title}</SectionHeading>
      {section.lines.length === 0 ? (
        <StatementRow
          muted
          label={`No ${title.toLowerCase()} accounts`}
          amount={section.total}
        />
      ) : (
        section.lines.map((line) => (
          <StatementRow
            key={line.accountCode}
            label={
              <AccountLabel code={line.accountCode} name={line.accountName} />
            }
            amount={line.amount}
          />
        ))
      )}
      <StatementRow
        kind="total"
        label={`Total ${title.toLowerCase()}`}
        amount={section.total}
      />
    </>
  );
}

function BalanceSheetPanel({ sheet }: { sheet: BalanceSheet }) {
  return (
    <StatementPanel
      title="Balance sheet"
      meta={`Amounts in ${sheet.baseCurrency}`}
      label="Balance sheet"
    >
      <Section title="Assets" section={sheet.assets} />
      <Section title="Liabilities" section={sheet.liabilities} />
      <Section title="Equity" section={sheet.equity} />
      <StatementRow
        kind="grand"
        label="Liabilities + equity"
        amount={sheet.totalLiabilitiesAndEquity}
      />
      <CheckLine
        ok={sheet.balanced}
        okText="Balanced: assets equal liabilities + equity"
        failText="Not balanced: assets and liabilities + equity differ"
      />
    </StatementPanel>
  );
}
