import { Inject, Injectable } from '@nestjs/common';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiKeyEntity } from './entities/api-key.entity.js';
import { ServiceEntity } from './entities/service.entity.js';

@Injectable()
export class ApiKeyRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): ApiKeyRepository {
    return new ApiKeyRepository(tx);
  }

  async findByPublicIdWithService(
    publicId: string,
  ): Promise<{ key: ApiKeyEntity; service: ServiceEntity } | null> {
    const row = await this.db.apiKey.findUnique({
      where: { publicId },
      include: { service: true },
    });

    if (!row) return null;

    return {
      key: ApiKeyEntity.fromRecord(row),
      service: ServiceEntity.fromRecord(row.service),
    };
  }

  async findInService(
    serviceId: string,
    id: string,
  ): Promise<ApiKeyEntity | null> {
    const row = await this.db.apiKey.findFirst({ where: { id, serviceId } });
    return row && ApiKeyEntity.fromRecord(row);
  }

  async findAllForService(serviceId: string): Promise<ApiKeyEntity[]> {
    const rows = await this.db.apiKey.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ApiKeyEntity.fromRecord(row));
  }

  async create(data: {
    publicId: string;
    secretHash: string;
    name: string;
    serviceId: string;
  }): Promise<ApiKeyEntity> {
    return ApiKeyEntity.fromRecord(await this.db.apiKey.create({ data }));
  }

  async revoke(id: string, at: Date): Promise<ApiKeyEntity> {
    const row = await this.db.apiKey.update({
      where: { id },
      data: { revokedAt: at },
    });
    return ApiKeyEntity.fromRecord(row);
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db.apiKey.update({ where: { id }, data: { lastUsedAt: at } });
  }
}
