import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DateRangeControl } from '@/components/layout/DateRangeControl';
import { BarList } from '@/components/ui/BarList';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { SecretCallout } from '@/components/ui/SecretCallout';
import { StatStrip, StatTile } from '@/components/ui/StatTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyAmount, Table, Td, Th } from '@/components/ui/Table';
import { TAccount } from '@/components/ui/TAccount';
import { formatCompact, formatMoney } from '@/lib/money';

export const metadata: Metadata = { title: 'Design system' };

const PALETTE = {
  Surfaces: ['paper', 'surface', 'muted'],
  Lines: ['line', 'line-strong', 'grid'],
  Ink: ['ink', 'ink-body', 'ink-2', 'ink-3', 'ink-faint'],
  Accent: ['gold', 'gold-hover', 'gold-wash'],
  Status: [
    'posted',
    'posted-wash',
    'pending',
    'pending-wash',
    'reversed',
    'reversed-wash',
    'duplicate',
    'duplicate-wash',
    'danger-line',
  ],
  'Chart series': ['series-1', 'series-2', 'series-3', 'series-4'],
};

const TYPE_SCALE = [
  { className: 'text-display', sample: 'Display', spec: '32 / 600' },
  { className: 'text-section', sample: 'Section title', spec: '20 / 600' },
  { className: 'text-panel-title', sample: 'Panel title', spec: '16 / 600' },
  { className: 'text-body', sample: 'Body and table text', spec: '14 / 400' },
  { className: 'label', sample: 'Label', spec: '12 / 500 caps' },
  {
    className: 'font-mono text-small',
    sample: 'ord_live_8f2c…a41e',
    spec: 'Mono · IDs, keys, times',
  },
];

const RULES = [
  'Each screen answers one money question at the top.',
  'Monochrome for structure. Gold marks the single most important thing on a screen, as a fill with ink on top.',
  'Group with whitespace and alignment. No drop shadows or gradients.',
  'A transaction always shows both legs, never only a net figure.',
  'Every status pairs a shape or symbol with its colour.',
];

const ngn = (amount: string) => ({ amount, currency: 'NGN' });
const tableAmount = (amount: string) =>
  formatMoney(ngn(amount), { symbol: false });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-section">{title}</h2>
      {children}
    </section>
  );
}

function TransactionHeader({
  id,
  detail,
  status,
}: {
  id: string;
  detail: string;
  status: 'posted' | 'reversed';
}) {
  return (
    <tr>
      <td colSpan={3} className="px-5 pt-3 pb-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
          <span className="font-mono">{id}</span>
          <span className="text-ink-2">{detail}</span>
          <StatusBadge status={status} size="sm" />
        </div>
      </td>
    </tr>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-300 flex-col gap-12 px-4 py-14 md:px-10">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-small text-ink-2">
          SAMPLE FIGURES, NOT REAL DATA
        </div>
        <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
          Quiet surfaces.
          <br />
          Precise numbers.
        </h1>
        <ul className="mt-2 flex max-w-prose list-disc flex-col gap-1 pl-5 text-ink-body">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </header>

      <Section title="Palette">
        <div className="flex flex-col gap-6">
          {Object.entries(PALETTE).map(([group, tokens]) => (
            <div key={group} className="flex flex-col gap-2">
              <div className="label">{group}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
                {tokens.map((token) => (
                  <div key={token} className="flex flex-col gap-1.5">
                    <div
                      className="h-14 rounded-control border border-line"
                      style={{ background: `var(--color-${token})` }}
                    />
                    <div className="font-mono text-caption">{token}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <Panel>
          <div className="flex flex-col divide-y divide-line">
            <div className="num flex flex-col gap-1.5 pb-4">
              <div className="label">Revenue · month to date</div>
              <div className="text-[clamp(1.75rem,6vw,3rem)] leading-[1.05] font-medium tracking-[-0.03em]">
                {formatMoney(ngn('4821793050'))}
              </div>
            </div>
            {TYPE_SCALE.map(({ className, sample, spec }) => (
              <div
                key={spec}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <span className={className}>{sample}</span>
                <span className="font-mono text-caption text-ink-2">
                  {spec}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Controls">
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Buttons">
            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary">Create API key</Button>
              <Button variant="ink">Export CSV</Button>
              <Button variant="outline">Cancel</Button>
              <Button variant="danger">Reverse transaction</Button>
              <Button variant="danger" size="sm">
                Revoke
              </Button>
              <Button variant="outline" disabled>
                Disabled
              </Button>
            </div>
          </Panel>
          <Panel title="Status">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="posted" />
              <StatusBadge status="pending" />
              <StatusBadge status="reversed" />
              <StatusBadge status="duplicate" />
              <StatusBadge status="live" />
            </div>
          </Panel>
          <Panel title="Inputs and date range">
            <Field label="Service name" hint="Shown in reports." />
            <Field
              label="Base currency"
              defaultValue="NAIRA"
              error="Use a three-letter ISO 4217 code."
            />
            <div>
              <DateRangeControl />
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Figures">
        <StatStrip>
          <StatTile
            label="Revenue · MTD"
            value={formatCompact(ngn('4821793050'))}
            change="▲ 12.4%"
            tone="positive"
            note="vs Sep"
          />
          <StatTile
            label="VAT payable"
            value={formatCompact(ngn('288000000'))}
            note="7.5% of taxable sales"
          />
          <StatTile
            label="Orders"
            value="18,402"
            change="▲ 3.1%"
            tone="positive"
            note="vs Sep"
          />
          <StatTile
            label="Reversals"
            value="0.4%"
            change="▲ 0.1 pt"
            tone="negative"
            note="· 73 orders"
          />
        </StatStrip>
      </Section>

      <Section title="Ledger">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Panel flush title="Ledger" meta="Both legs, always">
            <Table containerClassName="max-h-96">
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th numeric>Debit (₦)</Th>
                  <Th numeric>Credit (₦)</Th>
                </tr>
              </thead>
              <tbody>
                <TransactionHeader
                  id="txn_a41e"
                  detail="09:41:12 · MTN Data Bundles"
                  status="posted"
                />
                <tr>
                  <Td className="pl-9">cash</Td>
                  <Td numeric>{tableAmount('107500')}</Td>
                  <EmptyAmount />
                </tr>
                <tr>
                  <Td className="pl-9">vat_payable</Td>
                  <EmptyAmount />
                  <Td numeric>{tableAmount('7500')}</Td>
                </tr>
                <tr className="border-b border-line">
                  <Td className="pb-3 pl-9">data_bundles_revenue</Td>
                  <EmptyAmount />
                  <Td numeric className="pb-3">
                    {tableAmount('100000')}
                  </Td>
                </tr>
                <TransactionHeader
                  id="txn_77b0"
                  detail="09:40:58 · MoMo fee"
                  status="reversed"
                />
                <tr>
                  <Td className="pl-9 text-ink-3 line-through">cash</Td>
                  <Td numeric className="text-ink-3 line-through">
                    {tableAmount('5000')}
                  </Td>
                  <EmptyAmount />
                </tr>
                <tr>
                  <Td className="pb-3 pl-9 text-ink-3 line-through">
                    momo_fee_revenue
                  </Td>
                  <EmptyAmount />
                  <Td numeric className="pb-3 text-ink-3 line-through">
                    {tableAmount('5000')}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </Panel>
          <Panel
            title="Transaction detail"
            meta={<span className="font-mono text-caption">txn_a41e</span>}
          >
            <TAccount
              currency="NGN"
              note="order ord_8f2c"
              debits={[{ account: 'cash', amount: '107500' }]}
              credits={[
                { account: 'vat_payable', amount: '7500' },
                { account: 'revenue', amount: '100000' },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section title="Reporting and keys">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Revenue by service · MTD"
            meta="One scale, direct labels"
          >
            <BarList
              bars={[
                {
                  label: 'Data Bundles',
                  value: 29.1,
                  display: '₦29.1M',
                  series: 1,
                },
                { label: 'MoMo', value: 9.8, display: '₦9.8M', series: 2 },
                { label: 'MyCityApp', value: 5.6, display: '₦5.6M', series: 3 },
                { label: 'VAS', value: 3.7, display: '₦3.7M', series: 4 },
              ]}
            />
          </Panel>
          <Panel title="API keys" meta="Shown once, then masked">
            <SecretCallout secret="sk_live_sample_not_a_real_key" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-small">
              <span className="font-medium">simulator-traffic</span>
              <span className="font-mono text-ink-body">sk_live_samp…</span>
              <span className="text-ink-2">Used 3 min ago</span>
              <Button variant="danger" size="sm">
                Revoke
              </Button>
            </div>
          </Panel>
        </div>
      </Section>
    </main>
  );
}
