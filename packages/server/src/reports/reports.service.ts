import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import { EntryRepository } from '../ledger/entry.repository.js';
import { Money } from '../money/money.js';
import { ServicesService } from '../services/services.service.js';
import { BalancesQueryDto } from './dto/balances-query.dto.js';
import { DateRangeDto } from './dto/date-range.dto.js';

const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly entries: EntryRepository,
    private readonly services: ServicesService,
  ) {}

  /** A trial balance: every account's debits, credits and normal balance in base currency. */
  async balances(serviceId: string, userId: string, query: BalancesQueryDto) {
    const service = await this.services.assertCanAccess(serviceId, userId);
    const base = service.baseCurrency;
    const asOf = query.asOf ? new Date(query.asOf) : new Date();

    const accounts = await this.accounts.listForService(serviceId);
    const sums = await this.entries.sumBaseByAccount(serviceId, asOf);

    const totals = new Map(accounts.map((a) => [a.id, { debit: 0n, credit: 0n }]));
    for (const row of sums) {
      const t = totals.get(row.accountId);
      if (!t) continue;
      if (row.direction === 'DEBIT') t.debit += row.baseAmountMinor;
      else t.credit += row.baseAmountMinor;
    }

    let debitTotal = Money.zero(base);
    let creditTotal = Money.zero(base);

    const rows = accounts.map((account) => {
      const { debit, credit } = totals.get(account.id)!;
      debitTotal = debitTotal.add(Money.of(debit, base));
      creditTotal = creditTotal.add(Money.of(credit, base));

      return {
        accountCode: account.code,
        accountName: account.name,
        type: account.type,
        debit: Money.of(debit, base),
        credit: Money.of(credit, base),
        balance: Money.of(account.normalBalance(debit, credit), base),
      };
    });

    return {
      baseCurrency: base.code,
      asOf: asOf.toISOString(),
      accounts: rows,
      totals: { debit: debitTotal, credit: creditTotal },
    };
  }

  /**
   * Net income per local day (in the service's timezone) over a window
   * (default: the last 30 days), in base currency.
   */
  async revenue(serviceId: string, userId: string, query: DateRangeDto) {
    const service = await this.services.assertCanAccess(serviceId, userId);
    const base = service.baseCurrency;

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);

    const days = await this.entries.incomeByDay(serviceId, from, to, service.timezone);
    const series = days.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      amount: Money.of(BigInt(d.amountMinor), base),
    }));

    return {
      baseCurrency: base.code,
      timezone: service.timezone,
      window: { from: from.toISOString(), to: to.toISOString() },
      series,
      total: Money.sum(series.map((s) => s.amount), base),
    };
  }
}
