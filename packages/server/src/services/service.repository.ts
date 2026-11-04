import { Inject, Injectable } from '@nestjs/common';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServiceEntity } from './entities/service.entity.js';

@Injectable()
export class ServiceRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): ServiceRepository {
    return new ServiceRepository(tx);
  }

  async findById(id: string): Promise<ServiceEntity | null> {
    const row = await this.db.service.findUnique({ where: { id } });
    return row && ServiceEntity.fromRecord(row);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const row = await this.db.service.findUnique({
      where: { slug },
      select: { id: true },
    });
    return row !== null;
  }

  /** Newest first; all services when `ownerId` is omitted. */
  async findNewestFirst(ownerId?: string): Promise<ServiceEntity[]> {
    const rows = await this.db.service.findMany({
      where: ownerId ? { ownerId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ServiceEntity.fromRecord(row));
  }

  async create(data: {
    name: string;
    slug: string;
    baseCurrency: string;
    timezone?: string;
    ownerId: string;
  }): Promise<ServiceEntity> {
    return ServiceEntity.fromRecord(await this.db.service.create({ data }));
  }

  async delete(id: string): Promise<void> {
    await this.db.service.delete({ where: { id } });
  }
}
