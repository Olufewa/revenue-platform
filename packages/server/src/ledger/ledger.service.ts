import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServicesService } from '../services/services.service.js';
import { allocate, type PostingLine } from './allocation.js';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto.js';
import { ListEntriesDto } from './dto/list-entries.dto.js';
import { EventNotPendingError } from './event-not-pending.error.js';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async listAccounts() {
    return this.prisma.account.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createPostingRule(
    serviceId: string,
    userId: string,
    dto: CreatePostingRuleDto,
  ) {
    await this.services.assertCanAccess(serviceId, userId);

    const debits = dto.lines.filter((l) => l.direction === 'DEBIT');
    const credits = dto.lines.filter((l) => l.direction === 'CREDIT');

    if (debits.length === 0 || credits.length === 0) {
      throw new BadRequestException(
        'Posting rule must have at least one DEBIT and one CREDIT line',
      );
    }

    const debitDen = debits[0].denominator;
    if (debits.some((l) => l.denominator !== debitDen)) {
      throw new BadRequestException(
        'All DEBIT lines must share the same denominator',
      );
    }

    const creditDen = credits[0].denominator;
    if (credits.some((l) => l.denominator !== creditDen)) {
      throw new BadRequestException(
        'All CREDIT lines must share the same denominator',
      );
    }

    const debitNumSum = debits.reduce((sum, l) => sum + l.numerator, 0);
    if (debitNumSum !== debitDen) {
      throw new BadRequestException(
        'DEBIT numerators must sum to exactly the denominator',
      );
    }

    const creditNumSum = credits.reduce((sum, l) => sum + l.numerator, 0);
    if (creditNumSum !== creditDen) {
      throw new BadRequestException(
        'CREDIT numerators must sum to exactly the denominator',
      );
    }

    const uniqueCodes = [...new Set(dto.lines.map((l) => l.accountCode))];
    const existingAccounts = await this.prisma.account.findMany({
      where: { code: { in: uniqueCodes } },
    });

    if (existingAccounts.length !== uniqueCodes.length) {
      throw new BadRequestException('One or more account codes do not exist');
    }

    return this.prisma.postingRule.create({
      data: {
        serviceId,
        eventType: dto.eventType,
        effectiveFrom: new Date(dto.effectiveFrom),
        lines: dto.lines as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listPostingRules(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    return this.prisma.postingRule.findMany({
      where: { serviceId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async postEvents(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const pendingEvents = await this.prisma.revenueEvent.findMany({
      where: { serviceId, status: 'PENDING' },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });

    const accounts = await this.prisma.account.findMany();
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

    let posted = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of pendingEvents) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const rule = await tx.postingRule.findFirst({
            where: {
              serviceId,
              eventType: event.type,
              effectiveFrom: { lte: event.occurredAt },
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          if (!rule) {
            const updated = await tx.revenueEvent.updateMany({
              where: { id: event.id, status: 'PENDING' },
              data: {
                status: 'FAILED',
                failureReason: `No posting rule for ${event.type} effective at ${event.occurredAt.toISOString()}`,
              },
            });

            if (updated.count === 0) {
              throw new EventNotPendingError();
            }
            failed++;
            return;
          }

          const allocated = allocate(
            event.amountMinor,
            rule.lines as unknown as PostingLine[],
          );

          const entriesData = allocated.map((line) => {
            const accountId = accountMap.get(line.accountCode);
            if (!accountId) {
              throw new Error(
                `Account code ${line.accountCode} not found in database`,
              );
            }
            return {
              eventId: event.id,
              serviceId,
              accountId,
              direction: line.direction,
              amountMinor: line.amountMinor,
              currency: event.currency,
              occurredAt: event.occurredAt,
            };
          });

          await tx.entry.createMany({ data: entriesData });

          const updated = await tx.revenueEvent.updateMany({
            where: { id: event.id, status: 'PENDING' },
            data: {
              status: 'POSTED',
              failureReason: null,
            },
          });

          if (updated.count === 0) {
            throw new EventNotPendingError();
          }

          posted++;
        });
      } catch (error) {
        if (error instanceof EventNotPendingError) {
          skipped++;
        } else {
          const reason =
            error instanceof Error ? error.message : 'Unknown posting error';
          await this.prisma.revenueEvent.updateMany({
            where: { id: event.id, status: 'PENDING' },
            data: {
              status: 'FAILED',
              failureReason: reason,
            },
          });
          failed++;
        }
      }
    }

    return { posted, failed, skipped };
  }

  async listEntries(
    serviceId: string,
    userId: string,
    query: ListEntriesDto,
  ) {
    await this.services.assertCanAccess(serviceId, userId);

    const limit = query.limit ?? 20;

    const rows = await this.prisma.entry.findMany({
      where: { serviceId },
      include: { account: { select: { code: true, name: true } } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);

    return {
      entries: page.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        serviceId: row.serviceId,
        accountId: row.accountId,
        accountCode: row.account.code,
        accountName: row.account.name,
        direction: row.direction,
        amountMinor: row.amountMinor.toString(),
        currency: row.currency,
        occurredAt: row.occurredAt,
        bookedAt: row.bookedAt,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  async getBalances(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const grouped = await this.prisma.entry.groupBy({
      by: ['accountId', 'currency', 'direction'],
      where: { serviceId },
      _sum: { amountMinor: true },
    });

    const accounts = await this.prisma.account.findMany();
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const balanceMap = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        accountType: string;
        currency: string;
        debitMinor: bigint;
        creditMinor: bigint;
      }
    >();

    for (const row of grouped) {
      const key = `${row.accountId}:${row.currency}`;
      const account = accountMap.get(row.accountId);
      if (!account) continue;

      if (!balanceMap.has(key)) {
        balanceMap.set(key, {
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          currency: row.currency,
          debitMinor: 0n,
          creditMinor: 0n,
        });
      }

      const item = balanceMap.get(key)!;
      const sum = row._sum.amountMinor ?? 0n;
      if (row.direction === 'DEBIT') {
        item.debitMinor += sum;
      } else {
        item.creditMinor += sum;
      }
    }

    return Array.from(balanceMap.values())
      .sort(
        (a, b) =>
          a.accountCode.localeCompare(b.accountCode) ||
          a.currency.localeCompare(b.currency),
      )
      .map((b) => {
        const balance =
          b.accountType === 'ASSET'
            ? b.debitMinor - b.creditMinor
            : b.creditMinor - b.debitMinor;

        return {
          accountCode: b.accountCode,
          accountName: b.accountName,
          currency: b.currency,
          debitMinor: b.debitMinor.toString(),
          creditMinor: b.creditMinor.toString(),
          balanceMinor: balance.toString(),
        };
      });
  }
}
