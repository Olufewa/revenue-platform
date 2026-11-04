import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '../generated/prisma/client.js';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserEntity } from './entities/user.entity.js';

@Injectable()
export class UserRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): UserRepository {
    return new UserRepository(tx);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row && UserEntity.fromRecord(row);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row && UserEntity.fromRecord(row);
  }

  async findRole(id: string): Promise<Role | null> {
    const row = await this.db.user.findUnique({
      where: { id },
      select: { role: true },
    });
    return row?.role ?? null;
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<UserEntity> {
    return UserEntity.fromRecord(await this.db.user.create({ data }));
  }
}
