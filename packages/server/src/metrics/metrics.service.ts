import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServicesService } from '../services/services.service.js';
import { DateRangeDto } from './dto/date-range.dto.js';

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async rebuildAggregates(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          accountId: string;
          currency: string;
          day: Date;
          debitMinor: bigint;
          creditMinor: bigint;
          entryCount: number;
        }>
      >`
        SELECT
          "accountId",
          "currency",
          date_trunc('day', "occurredAt")::date AS "day",
          COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amountMinor" ELSE 0 END), 0) AS "debitMinor",
          COALESCE(SUM(CASE WHEN "direction" = 'CREDIT' THEN "amountMinor" ELSE 0 END), 0) AS "creditMinor",
          COUNT(*)::int AS "entryCount"
        FROM "Entry"
        WHERE "serviceId" = ${serviceId}
        GROUP BY "accountId", "currency", date_trunc('day', "occurredAt")::date
      `;

      await tx.dailyAggregate.deleteMany({
        where: { serviceId },
      });

      if (rows.length > 0) {
        await tx.dailyAggregate.createMany({
          data: rows.map((r) => ({
            serviceId,
            accountId: r.accountId,
            currency: r.currency,
            day: r.day,
            debitMinor: BigInt(r.debitMinor),
            creditMinor: BigInt(r.creditMinor),
            entryCount: r.entryCount,
          })),
        });
      }

      const distinctDays = new Set(
        rows.map((r) =>
          r.day instanceof Date
            ? r.day.toISOString().slice(0, 10)
            : String(r.day),
        ),
      ).size;

      return {
        days: distinctDays,
        rows: rows.length,
      };
    });
  }

  async getMetrics(
    serviceId: string,
    userId: string,
    dto: DateRangeDto,
  ) {
    await this.services.assertCanAccess(serviceId, userId);

    const { from, to } = this.resolveDateWindow(dto);

    const aggregates = await this.prisma.dailyAggregate.findMany({
      where: {
        serviceId,
        day: {
          gte: from,
          lte: to,
        },
      },
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
      orderBy: [{ day: 'asc' }, { accountId: 'asc' }, { currency: 'asc' }],
    });

    const totalsMap = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        accountType: string;
        currency: string;
        debitMinor: bigint;
        creditMinor: bigint;
        entryCount: number;
      }
    >();

    const series = aggregates.map((agg) => {
      const key = `${agg.accountId}:${agg.currency}`;
      if (!totalsMap.has(key)) {
        totalsMap.set(key, {
          accountCode: agg.account.code,
          accountName: agg.account.name,
          accountType: agg.account.type,
          currency: agg.currency,
          debitMinor: 0n,
          creditMinor: 0n,
          entryCount: 0,
        });
      }

      const t = totalsMap.get(key)!;
      t.debitMinor += agg.debitMinor;
      t.creditMinor += agg.creditMinor;
      t.entryCount += agg.entryCount;

      const balance =
        agg.account.type === 'ASSET'
          ? agg.debitMinor - agg.creditMinor
          : agg.creditMinor - agg.debitMinor;

      return {
        accountCode: agg.account.code,
        accountName: agg.account.name,
        currency: agg.currency,
        day: agg.day.toISOString().slice(0, 10),
        debitMinor: agg.debitMinor.toString(),
        creditMinor: agg.creditMinor.toString(),
        balanceMinor: balance.toString(),
        entryCount: agg.entryCount,
      };
    });

    const totals = Array.from(totalsMap.values())
      .sort(
        (a, b) =>
          a.accountCode.localeCompare(b.accountCode) ||
          a.currency.localeCompare(b.currency),
      )
      .map((t) => ({
        accountCode: t.accountCode,
        accountName: t.accountName,
        currency: t.currency,
        debitMinor: t.debitMinor.toString(),
        creditMinor: t.creditMinor.toString(),
        balanceMinor: (
          t.accountType === 'ASSET'
            ? t.debitMinor - t.creditMinor
            : t.creditMinor - t.debitMinor
        ).toString(),
        entryCount: t.entryCount,
      }));

    return {
      window: { from: from.toISOString(), to: to.toISOString() },
      series,
      totals,
    };
  }

  async getHealth(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const counts = await this.prisma.revenueEvent.groupBy({
      by: ['status'],
      where: { serviceId },
      _count: { _all: true },
    });

    let pending = 0;
    let posted = 0;
    let failed = 0;

    for (const c of counts) {
      if (c.status === 'PENDING') pending = c._count._all;
      if (c.status === 'POSTED') posted = c._count._all;
      if (c.status === 'FAILED') failed = c._count._all;
    }

    const failedSamples = await this.prisma.revenueEvent.findMany({
      where: { serviceId, status: 'FAILED' },
      select: {
        id: true,
        externalId: true,
        type: true,
        occurredAt: true,
        failureReason: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });

    const lagResult = await this.prisma.$queryRaw<
      Array<{ maxLag: number | null }>
    >`
      SELECT COALESCE(MAX(EXTRACT(EPOCH FROM ("receivedAt" - "occurredAt")))::int, 0) AS "maxLag"
      FROM "RevenueEvent"
      WHERE "serviceId" = ${serviceId}
    `;
    const ingestionLagSeconds = Math.max(0, lagResult[0]?.maxLag ?? 0);

    const postedSums = await this.prisma.revenueEvent.aggregate({
      where: { serviceId, status: 'POSTED', reversesEventId: null },
      _sum: { amountMinor: true },
    });

    const reversedSums = await this.prisma.revenueEvent.aggregate({
      where: { serviceId, status: 'POSTED', reversesEventId: { not: null } },
      _sum: { amountMinor: true },
    });

    const postedMinor = postedSums._sum.amountMinor ?? 0n;
    const reversedMinor = reversedSums._sum.amountMinor ?? 0n;

    const refundRateBps =
      postedMinor > 0n
        ? Number((reversedMinor * 10000n) / postedMinor)
        : 0;

    return {
      pending,
      posted,
      failed,
      failedSamples,
      ingestionLagSeconds,
      refundRateBps,
    };
  }

  async getOverview(dto: DateRangeDto) {
    const services = await this.prisma.service.findMany({
      orderBy: { name: 'asc' },
    });

    const { from, to } = this.resolveDateWindow(dto);

    const aggregates = await this.prisma.dailyAggregate.findMany({
      where: {
        day: {
          gte: from,
          lte: to,
        },
      },
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
    });

    const serviceTotals = new Map<
      string,
      Map<
        string,
        {
          accountCode: string;
          accountName: string;
          accountType: string;
          currency: string;
          debitMinor: bigint;
          creditMinor: bigint;
          entryCount: number;
        }
      >
    >();

    for (const agg of aggregates) {
      if (!serviceTotals.has(agg.serviceId)) {
        serviceTotals.set(agg.serviceId, new Map());
      }
      const accMap = serviceTotals.get(agg.serviceId)!;
      const key = `${agg.accountId}:${agg.currency}`;
      if (!accMap.has(key)) {
        accMap.set(key, {
          accountCode: agg.account.code,
          accountName: agg.account.name,
          accountType: agg.account.type,
          currency: agg.currency,
          debitMinor: 0n,
          creditMinor: 0n,
          entryCount: 0,
        });
      }
      const t = accMap.get(key)!;
      t.debitMinor += agg.debitMinor;
      t.creditMinor += agg.creditMinor;
      t.entryCount += agg.entryCount;
    }

    return services.map((service) => {
      const accMap = serviceTotals.get(service.id) ?? new Map();
      const totals = Array.from(accMap.values())
        .sort(
          (a, b) =>
            a.accountCode.localeCompare(b.accountCode) ||
            a.currency.localeCompare(b.currency),
        )
        .map((t) => ({
          accountCode: t.accountCode,
          accountName: t.accountName,
          currency: t.currency,
          debitMinor: t.debitMinor.toString(),
          creditMinor: t.creditMinor.toString(),
          balanceMinor: (
            t.accountType === 'ASSET'
              ? t.debitMinor - t.creditMinor
              : t.creditMinor - t.debitMinor
          ).toString(),
          entryCount: t.entryCount,
        }));

      return {
        serviceId: service.id,
        serviceName: service.name,
        serviceSlug: service.slug,
        totals,
      };
    });
  }

  private resolveDateWindow(dto: DateRangeDto) {
    const now = new Date();
    const to = dto.to ? new Date(dto.to) : now;
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    return { from, to };
  }
}
