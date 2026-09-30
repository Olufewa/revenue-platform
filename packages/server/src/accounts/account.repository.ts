import { Inject, Injectable } from '@nestjs/common';
import type { AccountType } from '../generated/prisma/client.js';
import type { DbClient } from '../prisma/db-client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountEntity } from './entities/account.entity.js';

@Injectable()
export class AccountRepository {
  constructor(@Inject(PrismaService) private readonly db: DbClient) {}

  withTx(tx: DbClient): AccountRepository {
    return new AccountRepository(tx);
  }

  async create(data: {
    serviceId: string;
    code: string;
    name: string;
    type: AccountType;
  }): Promise<AccountEntity> {
    return AccountEntity.fromRecord(await this.db.account.create({ data }));
  }

  async listForService(serviceId: string): Promise<AccountEntity[]> {
    const rows = await this.db.account.findMany({
      where: { serviceId },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => AccountEntity.fromRecord(row));
  }

  async findByCodes(serviceId: string, codes: string[]): Promise<AccountEntity[]> {
    const rows = await this.db.account.findMany({
      where: { serviceId, code: { in: codes } },
    });
    return rows.map((row) => AccountEntity.fromRecord(row));
  }
}
