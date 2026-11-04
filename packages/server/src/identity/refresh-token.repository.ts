import { Inject, Injectable } from '@nestjs/common';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): RefreshTokenRepository {
    return new RefreshTokenRepository(tx);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const row = await this.db.refreshToken.findUnique({
      where: { tokenHash },
    });
    return row && RefreshTokenEntity.fromRecord(row);
  }

  async create(data: {
    tokenHash: string;
    familyId: string;
    userId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.refreshToken.create({ data });
  }

  /** Keeps the first rotation time, so repeats can't extend the grace window. */
  async markRotated(id: string, at: Date): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { id, rotatedAt: null },
      data: { rotatedAt: at },
    });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async deleteExpiredForUser(userId: string, now: Date): Promise<void> {
    await this.db.refreshToken.deleteMany({
      where: { userId, expiresAt: { lte: now } },
    });
  }
}
