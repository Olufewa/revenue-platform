import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountRepository } from '../accounts/account.repository.js';
import type { EntryRepository } from '../ledger/entry.repository.js';
import type { ServicesService } from '../services/services.service.js';
import { accountFixture, serviceFixture } from '../test/fixtures.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  const accounts = { listForService: vi.fn() };
  const entries = { sumBaseByAccount: vi.fn(), incomeByDay: vi.fn() };
  const services = { assertCanAccess: vi.fn() };
  let sut: ReportsService;

  beforeEach(() => {
    vi.resetAllMocks();
    services.assertCanAccess.mockResolvedValue(serviceFixture());
    sut = new ReportsService(
      accounts as unknown as AccountRepository,
      entries as unknown as EntryRepository,
      services as unknown as ServicesService,
    );
  });

  it('builds a trial balance with normal-side balances', async () => {
    accounts.listForService.mockResolvedValue([
      accountFixture('bundle_revenue', 'INCOME'),
      accountFixture('cash', 'ASSET'),
      accountFixture('marketing', 'EXPENSE'),
      accountFixture('vat_payable', 'LIABILITY'),
    ]);
    // A ₦3,500 sale, then half of it refunded.
    entries.sumBaseByAccount.mockResolvedValue([
      { accountId: 'acc_cash', direction: 'DEBIT', baseAmountMinor: 350000n },
      { accountId: 'acc_cash', direction: 'CREDIT', baseAmountMinor: 175000n },
      { accountId: 'acc_vat_payable', direction: 'CREDIT', baseAmountMinor: 24419n },
      { accountId: 'acc_vat_payable', direction: 'DEBIT', baseAmountMinor: 12209n },
      { accountId: 'acc_bundle_revenue', direction: 'CREDIT', baseAmountMinor: 325581n },
      { accountId: 'acc_bundle_revenue', direction: 'DEBIT', baseAmountMinor: 162791n },
    ]);

    const result = JSON.parse(
      JSON.stringify(await sut.balances('svc_1', 'usr_1', { asOf: '2026-09-30T00:00:00.000Z' })),
    );

    expect(entries.sumBaseByAccount).toHaveBeenCalledWith(
      'svc_1',
      new Date('2026-09-30T00:00:00.000Z'),
    );
    expect(result.baseCurrency).toBe('NGN');
    expect(
      Object.fromEntries(
        result.accounts.map((a: { accountCode: string; balance: { amount: string } }) => [
          a.accountCode,
          a.balance.amount,
        ]),
      ),
    ).toEqual({
      bundle_revenue: '162790',
      cash: '175000',
      marketing: '0',
      vat_payable: '12210',
    });
    expect(result.totals.debit).toEqual(result.totals.credit);
  });

  it('reports daily revenue in base currency with a total', async () => {
    entries.incomeByDay.mockResolvedValue([
      { day: new Date('2026-09-15T00:00:00.000Z'), amountMinor: 325581n },
      { day: new Date('2026-09-16T00:00:00.000Z'), amountMinor: -162791n },
    ]);

    const result = JSON.parse(
      JSON.stringify(
        await sut.revenue('svc_1', 'usr_1', {
          from: '2026-09-01T00:00:00.000Z',
          to: '2026-09-30T00:00:00.000Z',
        }),
      ),
    );

    expect(result.series).toEqual([
      { day: '2026-09-15', amount: { amount: '325581', currency: 'NGN' } },
      { day: '2026-09-16', amount: { amount: '-162791', currency: 'NGN' } },
    ]);
    expect(result.total).toEqual({ amount: '162790', currency: 'NGN' });
  });

  it('defaults the revenue window to the last 30 days', async () => {
    entries.incomeByDay.mockResolvedValue([]);

    const result = await sut.revenue('svc_1', 'usr_1', {});
    const from = new Date(result.window.from).getTime();
    const to = new Date(result.window.to).getTime();

    expect(to - from).toBe(30 * 24 * 60 * 60 * 1000);
    expect(result.total.isZero()).toBe(true);
  });
});
