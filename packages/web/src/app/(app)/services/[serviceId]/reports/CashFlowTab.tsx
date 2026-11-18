'use client';

import { useCallback } from 'react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { api } from '@/lib/api';
import { formatMoney, type Money } from '@/lib/money';
import {
  customDatesReady,
  formatWindow,
  periodWindow,
  type CustomDates,
  type DateWindow,
  type Period,
} from '@/lib/report-period';
import type { CashFlow, StatementLine } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { PeriodControls, type PeriodProps } from './PeriodControls';
import {
  AccountLabel,
  CheckLine,
  SectionHeading,
  StatementPanel,
  StatementRow,
} from './statement';

interface CashFlowData {
  window: DateWindow;
  flow: CashFlow;
}

async function loadCashFlow(
  serviceId: string,
  period: Period,
  custom: CustomDates,
): Promise<CashFlowData | null> {
  const window = periodWindow(period, new Date(), custom);
  if (!window) return null;
  const path = `/services/${encodeURIComponent(serviceId)}/reports/cash-flow`;
  const flow = await api<CashFlow>(
    `${path}?${new URLSearchParams({ ...window })}`,
  );
  return { window, flow };
}

/** Accounts that didn't move add nothing to the story, so they're left out. */
const moved = (lines: StatementLine[]) =>
  lines.filter((line) => BigInt(line.amount.amount) !== 0n);

export function CashFlowTab({
  serviceId,
  ...periodProps
}: PeriodProps & { serviceId: string }) {
  const { period, custom } = periodProps;
  const load = useCallback(
    () => loadCashFlow(serviceId, period, custom),
    [serviceId, period, custom],
  );
  const { data, error, loading, reload } = useApi(load);
  const ready = period !== 'Custom' || customDatesReady(custom);

  return (
    <>
      <PeriodControls
        {...periodProps}
        onRefresh={reload}
        summary={data ? formatWindow(data.window) : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {!ready && <p className="text-ink-2">Pick a start and an end day.</p>}
      {ready && loading && <p className="text-ink-2">Loading the cash flow…</p>}
      {data && <CashFlowPanel data={data} />}
    </>
  );
}

/** A small label/amount line under the statement, for the cash check. */
function CashLine({ label, amount }: { label: string; amount: Money }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-2">{label}</span>
      <span>{formatMoney(amount, { symbol: false })}</span>
    </div>
  );
}

function CashFlowPanel({ data }: { data: CashFlowData }) {
  const { flow, window } = data;
  const adjustments = moved(flow.operating.adjustments);
  const financing = moved(flow.financing.lines);
  const lastDay = new Date(new Date(window.to).getTime() - 1);
  const day = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <StatementPanel
      label="Cash flow"
      title={
        <>
          Cash flow{' '}
          <span className="text-body font-normal text-ink-2">
            · {formatWindow(window)}
          </span>
        </>
      }
      meta={`Indirect method · ${flow.baseCurrency}`}
    >
      <SectionHeading>Operating</SectionHeading>
      <StatementRow label="Net income" amount={flow.operating.netIncome} />
      {adjustments.map((line) => (
        <StatementRow
          key={line.accountCode}
          label={
            <>
              <span className="text-ink-2">Change in</span>{' '}
              <AccountLabel code={line.accountCode} name={line.accountName} />
            </>
          }
          amount={line.amount}
        />
      ))}
      <StatementRow
        kind="total"
        label="Net cash from operating"
        amount={flow.operating.total}
      />

      <SectionHeading>Financing</SectionHeading>
      {financing.length === 0 ? (
        <StatementRow
          muted
          label="No financing activity"
          amount={flow.financing.total}
        />
      ) : (
        financing.map((line) => (
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
        label="Net cash from financing"
        amount={flow.financing.total}
      />

      <StatementRow
        kind="grand"
        label="Net change in cash"
        amount={flow.netChangeInCash}
      />

      <div className="flex flex-col gap-1.5 px-6 pb-1.5 text-small">
        <CashLine
          label={`Cash at the start of ${day(new Date(window.from))}`}
          amount={flow.openingCash}
        />
        <CashLine label="Cash received" amount={flow.cashReceived} />
        <CashLine label="Cash paid out" amount={flow.cashPaidOut} />
        <CashLine
          label={`Cash at the end of ${day(lastDay)}`}
          amount={flow.closingCash}
        />
      </div>

      {flow.cashAccounts.length === 0 ? (
        <p className="px-6 pt-2 pb-5 text-small text-ink-2">
          This service has no cash account yet (an ASSET coded{' '}
          <span className="font-mono">cash</span> or{' '}
          <span className="font-mono">cash_…</span>).
        </p>
      ) : (
        <CheckLine
          ok={flow.reconciles}
          okText="Matches the cash accounts: start + change = end"
          failText="Doesn't match the cash accounts"
        />
      )}
    </StatementPanel>
  );
}
