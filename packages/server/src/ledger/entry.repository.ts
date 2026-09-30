import { Inject, Injectable } from '@nestjs/common';
import type { EntryDirection } from '../generated/prisma/client.js';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EntryRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): EntryRepository {
    return new EntryRepository(tx);
  }

  /** Base-currency totals per account and direction, up to `asOf` inclusive. */
  async sumBaseByAccount(
    serviceId: string,
    asOf: Date,
  ): Promise<Array<{ accountId: string; direction: EntryDirection; baseAmountMinor: bigint }>> {
    const grouped = await this.db.entry.groupBy({
      by: ['accountId', 'direction'],
      where: { serviceId, occurredAt: { lte: asOf } },
      _sum: { baseAmountMinor: true },
    });

    return grouped.map((row) => ({
      accountId: row.accountId,
      direction: row.direction,
      baseAmountMinor: row._sum.baseAmountMinor ?? 0n,
    }));
  }

  /** Net income (credits − debits on INCOME accounts) in base currency, per UTC day. */
  async incomeByDay(
    serviceId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ day: Date; amountMinor: bigint }>> {
    return this.db.$queryRaw<Array<{ day: Date; amountMinor: bigint }>>`
      SELECT
        date_trunc('day', e."occurredAt")::date AS "day",
        SUM(CASE WHEN e."direction" = 'CREDIT' THEN e."baseAmountMinor" ELSE -e."baseAmountMinor" END)::bigint AS "amountMinor"
      FROM "Entry" e
      JOIN "Account" a ON a."id" = e."accountId"
      WHERE e."serviceId" = ${serviceId}
        AND a."type" = 'INCOME'
        AND e."occurredAt" >= ${from}
        AND e."occurredAt" <= ${to}
      GROUP BY 1
      ORDER BY 1
    `;
  }
}
