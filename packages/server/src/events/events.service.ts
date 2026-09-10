import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServicesService } from '../services/services.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { ListEventsDto } from './dto/list-events.dto.js';

type EventRow = {
  id: string;
  serviceId: string;
  externalId: string;
  type: string;
  amountMinor: bigint;
  currency: string;
  occurredAt: Date;
  metadata: unknown;
  status: string;
  receivedAt: Date;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async ingest(serviceId: string, dto: CreateEventDto) {
    const where = {
      serviceId_externalId: { serviceId, externalId: dto.externalId },
    };

    const existing = await this.prisma.revenueEvent.findUnique({ where });

    if (existing) {
      return { duplicate: true, event: this.publicEvent(existing) };
    }

    try {
      const created = await this.prisma.revenueEvent.create({
        data: {
          serviceId,
          externalId: dto.externalId,
          type: dto.type,
          amountMinor: BigInt(dto.amountMinor),
          currency: dto.currency,
          occurredAt: new Date(dto.occurredAt),
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      return { duplicate: false, event: this.publicEvent(created) };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }

      const raced = await this.prisma.revenueEvent.findUniqueOrThrow({ where });
      return { duplicate: true, event: this.publicEvent(raced) };
    }
  }

  async list(serviceId: string, query: ListEventsDto) {
    const limit = query.limit ?? 20;

    const rows = await this.prisma.revenueEvent.findMany({
      where: {
        serviceId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);

    return {
      events: page.map((row) => this.publicEvent(row)),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  async findOne(serviceId: string, id: string) {
    const event = await this.prisma.revenueEvent.findFirst({
      where: { id, serviceId },
    });

    if (!event) {
      throw new NotFoundException('No such event on this service');
    }

    return this.publicEvent(event);
  }

  async listForUser(serviceId: string, userId: string, query: ListEventsDto) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.list(serviceId, query);
  }

  async summaryForUser(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const grouped = await this.prisma.revenueEvent.groupBy({
      by: ['currency', 'status'],
      where: { serviceId },
      _sum: { amountMinor: true },
      _count: { _all: true },
    });

    return grouped.map((row) => ({
      currency: row.currency,
      status: row.status,
      count: row._count._all,
      totalMinor: (row._sum.amountMinor ?? BigInt(0)).toString(),
    }));
  }

  private publicEvent(event: EventRow) {
    return {
      id: event.id,
      externalId: event.externalId,
      type: event.type,
      amountMinor: event.amountMinor.toString(),
      currency: event.currency,
      occurredAt: event.occurredAt,
      metadata: event.metadata ?? null,
      status: event.status,
      receivedAt: event.receivedAt,
    };
  }
}
