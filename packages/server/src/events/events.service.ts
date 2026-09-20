import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  reversesEventId?: string | null;
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

    let reversesEventId: string | null = null;

    if (dto.reversesExternalId) {
      const original = await this.prisma.revenueEvent.findUnique({
        where: {
          serviceId_externalId: {
            serviceId,
            externalId: dto.reversesExternalId,
          },
        },
      });

      if (!original) {
        throw new NotFoundException('No such event on this service');
      }

      if (dto.currency !== original.currency) {
        throw new BadRequestException(
          'Reversal currency does not match original event currency',
        );
      }

      const existingReversals = await this.prisma.revenueEvent.aggregate({
        where: { reversesEventId: original.id },
        _sum: { amountMinor: true },
      });

      const alreadyReversed = existingReversals._sum.amountMinor ?? 0n;
      const requestedAmount = BigInt(dto.amountMinor);
      const remaining = original.amountMinor - alreadyReversed;

      if (alreadyReversed + requestedAmount > original.amountMinor) {
        throw new ConflictException(
          `Reversal amount exceeds remaining refundable amount (${remaining}) on original event`,
        );
      }

      reversesEventId = original.id;
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
          reversesEventId,
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

  async getAdjustments(serviceId: string, eventId: string) {
    const original = await this.prisma.revenueEvent.findFirst({
      where: { id: eventId, serviceId },
    });

    if (!original) {
      throw new NotFoundException('No such event on this service');
    }

    const adjustments = await this.prisma.revenueEvent.findMany({
      where: { reversesEventId: eventId, serviceId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });

    const reversedMinor = adjustments.reduce(
      (sum, adj) => sum + adj.amountMinor,
      0n,
    );
    const remainingMinor = original.amountMinor - reversedMinor;

    return {
      originalAmountMinor: original.amountMinor.toString(),
      reversedMinor: reversedMinor.toString(),
      remainingMinor: remainingMinor.toString(),
      adjustments: adjustments.map((adj) => this.publicEvent(adj)),
    };
  }

  async getAdjustmentsForUser(
    serviceId: string,
    userId: string,
    eventId: string,
  ) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.getAdjustments(serviceId, eventId);
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
      reversesEventId: event.reversesEventId ?? null,
    };
  }
}
