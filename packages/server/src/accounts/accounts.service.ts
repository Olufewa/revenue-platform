import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../prisma/db-client.js';
import { ServicesService } from '../services/services.service.js';
import { AccountRepository } from './account.repository.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly services: ServicesService,
  ) {}

  async create(serviceId: string, userId: string, dto: CreateAccountDto) {
    await this.services.assertCanAccess(serviceId, userId);

    try {
      return await this.accounts.create({ serviceId, ...dto });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Account "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  /** Renames and/or archives an account. Its code and type never change. */
  async update(serviceId: string, userId: string, code: string, dto: UpdateAccountDto) {
    await this.services.assertCanAccess(serviceId, userId);

    const account = await this.accounts.findByCode(serviceId, code);
    if (!account) {
      throw new NotFoundException(`No account "${code}" on this service`);
    }

    const archivedAt =
      dto.archived === undefined
        ? undefined
        : dto.archived
          ? (account.archivedAt ?? new Date())
          : null;

    if (dto.name === undefined && archivedAt === undefined) {
      return account;
    }

    return this.accounts.update(account.id, { name: dto.name, archivedAt });
  }

  async list(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    return this.accounts.listForService(serviceId);
  }
}
