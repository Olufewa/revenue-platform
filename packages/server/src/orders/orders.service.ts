import { Injectable, NotFoundException } from '@nestjs/common';
import { ListPageDto } from '../common/list-page.dto.js';
import { assertSameRequest, requestHash } from '../common/request-hash.js';
import { Money } from '../money/money.js';
import { isUniqueViolation } from '../prisma/db-client.js';
import { ServicesService } from '../services/services.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderRepository } from './order.repository.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly services: ServicesService,
  ) {}

  /**
   * Records an order once. Resending the identical request returns the
   * original; reusing its externalId for a different request is a 422.
   */
  async create(serviceId: string, dto: CreateOrderDto) {
    const hash = requestHash(dto);
    const existing = await this.orders.findByExternalId(serviceId, dto.externalId);

    if (existing) {
      assertSameRequest(existing.requestHash, hash, dto.externalId);
      return { duplicate: true, order: existing };
    }

    try {
      const order = await this.orders.create({
        serviceId,
        externalId: dto.externalId,
        total: Money.of(dto.amount, dto.currency),
        description: dto.description,
        customerRef: dto.customerRef,
        metadata: dto.metadata,
        requestHash: hash,
        placedAt: new Date(dto.placedAt),
      });

      return { duplicate: false, order };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const raced = (await this.orders.findByExternalId(serviceId, dto.externalId))!;
      assertSameRequest(raced.requestHash, hash, dto.externalId);
      return { duplicate: true, order: raced };
    }
  }

  async list(serviceId: string, query: ListPageDto) {
    const page = await this.orders.listPage(serviceId, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
    });

    return { orders: page.items, nextCursor: page.nextCursor };
  }

  async findOne(serviceId: string, id: string) {
    const order = await this.orders.findInService(serviceId, id);

    if (!order) {
      throw new NotFoundException('No such order on this service');
    }

    return order;
  }

  async listForUser(serviceId: string, userId: string, query: ListPageDto) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.list(serviceId, query);
  }

  async findOneForUser(serviceId: string, userId: string, id: string) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.findOne(serviceId, id);
  }
}
