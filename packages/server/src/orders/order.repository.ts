import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { Money } from '../money/money.js';
import type { DbClient } from '../prisma/db-client.js';
import type { Page } from '../prisma/page.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEntity } from './entities/order.entity.js';

export type NewOrder = {
  serviceId: string;
  externalId: string;
  total: Money;
  description?: string;
  customerRef?: string;
  metadata?: Record<string, unknown>;
  requestHash: string;
  placedAt: Date;
};

@Injectable()
export class OrderRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): OrderRepository {
    return new OrderRepository(tx);
  }

  async findByExternalId(serviceId: string, externalId: string): Promise<OrderEntity | null> {
    const row = await this.db.order.findUnique({
      where: { serviceId_externalId: { serviceId, externalId } },
    });
    return row && OrderEntity.fromRecord(row);
  }

  async findInService(serviceId: string, id: string): Promise<OrderEntity | null> {
    const row = await this.db.order.findFirst({ where: { id, serviceId } });
    return row && OrderEntity.fromRecord(row);
  }

  /** Newest first, cursor-paged by id. */
  async listPage(
    serviceId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<Page<OrderEntity>> {
    const rows = await this.db.order.findMany({
      where: { serviceId },
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, opts.limit);

    return {
      items: page.map((row) => OrderEntity.fromRecord(row)),
      nextCursor: rows.length > opts.limit ? page[page.length - 1].id : null,
    };
  }

  async create(order: NewOrder): Promise<OrderEntity> {
    const row = await this.db.order.create({
      data: {
        serviceId: order.serviceId,
        externalId: order.externalId,
        amountMinor: order.total.amountMinor,
        currency: order.total.currency.code,
        description: order.description,
        customerRef: order.customerRef,
        metadata: order.metadata as Prisma.InputJsonValue | undefined,
        requestHash: order.requestHash,
        placedAt: order.placedAt,
      },
    });
    return OrderEntity.fromRecord(row);
  }
}
