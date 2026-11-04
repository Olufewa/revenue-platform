import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import type { AccountEntity } from '../accounts/entities/account.entity.js';
import type { AccountType } from '../generated/prisma/client.js';
import { EntryRepository } from '../ledger/entry.repository.js';
import type { Currency } from '../money/currency.js';
import { Money } from '../money/money.js';
import { ServicesService } from '../services/services.service.js';
import { BalancesQueryDto } from './dto/balances-query.dto.js';
import { DateRangeDto } from './dto/date-range.dto.js';

const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** One account's debits and credits (minor units, base currency). */
type AccountTotals = { account: AccountEntity; debit: bigint; credit: bigint };

/** A cash account is an ASSET coded `cash` or `cash_<something>`. */
function isCash(account: AccountEntity): boolean {
  return (
    account.type === 'ASSET' &&
    (account.code === 'cash' || account.code.startsWith('cash_'))
  );
}

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

    const totals = await this.totalsByAccount(serviceId, asOf);

    let debitTotal = Money.zero(base);
    let creditTotal = Money.zero(base);

    const rows = totals.map(({ account, debit, credit }) => {
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
    const { from, to } = this.window(query);

    const days = await this.entries.incomeByDay(
      serviceId,
      from,
      to,
      service.timezone,
    );
    const series = days.map((d) => ({
      day: d.day.toISOString().slice(0, 10),
      amount: Money.of(BigInt(d.amountMinor), base),
    }));

    return {
      baseCurrency: base.code,
      timezone: service.timezone,
      window: { from: from.toISOString(), to: to.toISOString() },
      series,
      total: Money.sum(
        series.map((s) => s.amount),
        base,
      ),
    };
  }

  /**
   * Income statement (profit and loss) for a period: income earned minus
   * expenses incurred between `from` and `to` (default: the last 30 days).
   */
  async incomeStatement(
    serviceId: string,
    userId: string,
    query: DateRangeDto,
  ) {
    const service = await this.services.assertCanAccess(serviceId, userId);
    const base = service.baseCurrency;
    const { from, to } = this.window(query);

    const totals = await this.totalsByAccount(serviceId, to, from);
    const income = this.section(totals, 'INCOME', base);
    const expenses = this.section(totals, 'EXPENSE', base);

    return {
      baseCurrency: base.code,
      period: { from: from.toISOString(), to: to.toISOString() },
      income,
      expenses,
      netIncome: income.total.subtract(expenses.total),
    };
  }

  /**
   * Balance sheet at an instant (default: now): what the service holds
   * (assets) against what it owes (liabilities) and what is left over
   * (equity). Income less expenses to date shows up as retained earnings,
   * so assets always equal liabilities plus equity.
   */
  async balanceSheet(
    serviceId: string,
    userId: string,
    query: BalancesQueryDto,
  ) {
    const service = await this.services.assertCanAccess(serviceId, userId);
    const base = service.baseCurrency;
    const asOf = query.asOf ? new Date(query.asOf) : new Date();

    const totals = await this.totalsByAccount(serviceId, asOf);
    const assets = this.section(totals, 'ASSET', base);
    const liabilities = this.section(totals, 'LIABILITY', base);
    const equity = this.section(totals, 'EQUITY', base);

    const retainedEarnings = this.section(
      totals,
      'INCOME',
      base,
    ).total.subtract(this.section(totals, 'EXPENSE', base).total);
    equity.lines.push({
      accountCode: 'retained_earnings',
      accountName: 'Retained earnings (income less expenses to date)',
      amount: retainedEarnings,
    });
    equity.total = equity.total.add(retainedEarnings);

    const totalLiabilitiesAndEquity = liabilities.total.add(equity.total);

    return {
      baseCurrency: base.code,
      asOf: asOf.toISOString(),
      assets,
      liabilities,
      equity,
      totalLiabilitiesAndEquity,
      balanced: assets.total.equals(totalLiabilitiesAndEquity),
    };
  }

  /**
   * Cash flow statement for a period (default: the last 30 days), indirect
   * method: start from net income, add the movement on every non-cash
   * balance sheet account, and the result is the change in cash. It is
   * checked against the cash accounts themselves (opening + change = closing).
   */
  async cashFlow(serviceId: string, userId: string, query: DateRangeDto) {
    const service = await this.services.assertCanAccess(serviceId, userId);
    const base = service.baseCurrency;
    const { from, to } = this.window(query);

    const period = await this.totalsByAccount(serviceId, to, from);
    const beforePeriod = await this.totalsByAccount(
      serviceId,
      new Date(from.getTime() - 1),
    );

    // For any account, credits − debits is the cash it "brought in":
    // more income, more VAT owed or more owner money all mean more cash.
    const inflow = (t: AccountTotals) => Money.of(t.credit - t.debit, base);
    const line = (t: AccountTotals) => ({
      accountCode: t.account.code,
      accountName: t.account.name,
      amount: inflow(t),
    });
    const sum = (lines: { amount: Money }[]) =>
      Money.sum(
        lines.map((l) => l.amount),
        base,
      );

    const netIncome = Money.sum(
      period
        .filter(
          (t) => t.account.type === 'INCOME' || t.account.type === 'EXPENSE',
        )
        .map(inflow),
      base,
    );
    const adjustments = period
      .filter(
        (t) =>
          t.account.type === 'LIABILITY' ||
          (t.account.type === 'ASSET' && !isCash(t.account)),
      )
      .map(line);
    const financing = period
      .filter((t) => t.account.type === 'EQUITY')
      .map(line);

    const operatingTotal = netIncome.add(sum(adjustments));
    const financingTotal = sum(financing);
    const netChangeInCash = operatingTotal.add(financingTotal);

    const cash = period.filter((t) => isCash(t.account));
    const received = Money.sum(
      cash.map((t) => Money.of(t.debit, base)),
      base,
    );
    const paidOut = Money.sum(
      cash.map((t) => Money.of(t.credit, base)),
      base,
    );
    const openingCash = Money.sum(
      beforePeriod
        .filter((t) => isCash(t.account))
        .map((t) => Money.of(t.debit - t.credit, base)),
      base,
    );
    const closingCash = openingCash.add(received).subtract(paidOut);

    return {
      baseCurrency: base.code,
      period: { from: from.toISOString(), to: to.toISOString() },
      cashAccounts: cash.map((t) => t.account.code),
      operating: { netIncome, adjustments, total: operatingTotal },
      financing: { lines: financing, total: financingTotal },
      netChangeInCash,
      cashReceived: received,
      cashPaidOut: paidOut,
      openingCash,
      closingCash,
      reconciles: openingCash.add(netChangeInCash).equals(closingCash),
    };
  }

  /** `from`/`to` from the query, defaulting to the 30 days up to now. */
  private window(query: DateRangeDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_WINDOW_MS);
    return { from, to };
  }

  /** Every account with its debit and credit totals (zero if unused). */
  private async totalsByAccount(
    serviceId: string,
    asOf: Date,
    from?: Date,
  ): Promise<AccountTotals[]> {
    const accounts = await this.accounts.listForService(serviceId);
    const sums = await this.entries.sumBaseByAccount(serviceId, asOf, from);

    const totals = new Map(
      accounts.map((account) => [
        account.id,
        { account, debit: 0n, credit: 0n },
      ]),
    );
    for (const row of sums) {
      const t = totals.get(row.accountId);
      if (!t) continue;
      if (row.direction === 'DEBIT') t.debit += row.baseAmountMinor;
      else t.credit += row.baseAmountMinor;
    }
    return [...totals.values()];
  }

  /** The accounts of one type as statement lines (normal-side balances) plus a total. */
  private section(totals: AccountTotals[], type: AccountType, base: Currency) {
    const lines = totals
      .filter((t) => t.account.type === type)
      .map(({ account, debit, credit }) => ({
        accountCode: account.code,
        accountName: account.name,
        amount: Money.of(account.normalBalance(debit, credit), base),
      }));
    return {
      lines,
      total: Money.sum(
        lines.map((l) => l.amount),
        base,
      ),
    };
  }
}
