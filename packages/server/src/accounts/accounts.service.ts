import { ConflictException, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../prisma/db-client.js';
import { ServicesService } from '../services/services.service.js';
import { AccountRepository } from './account.repository.js';
import { CreateAccountDto } from './dto/create-account.dto.js';

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

  async list(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    return this.accounts.listForService(serviceId);
  }
}
