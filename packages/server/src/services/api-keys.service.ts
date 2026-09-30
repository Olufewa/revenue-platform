import { Injectable, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { ApiKeyRepository } from './api-key.repository.js';
import { ApiKeyEntity } from './entities/api-key.entity.js';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeys: ApiKeyRepository,
    private readonly services: ServicesService,
  ) {}

  async create(serviceId: string, userId: string, dto: CreateApiKeyDto) {
    await this.services.assertCanAccess(serviceId, userId);

    const { publicId, secretHash, plainKey } = ApiKeyEntity.generate();

    const key = await this.apiKeys.create({
      publicId,
      secretHash,
      name: dto.name,
      serviceId,
    });

    return {
      ...key.toJSON(),
      key: plainKey,
      warning: 'Copy this key now. It will not be shown again.',
    };
  }

  async findAll(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    return this.apiKeys.findAllForService(serviceId);
  }

  async revoke(serviceId: string, keyId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const key = await this.apiKeys.findInService(serviceId, keyId);

    if (!key) {
      throw new NotFoundException('No such API key on this service');
    }

    if (!key.isActive) {
      return key;
    }

    return this.apiKeys.revoke(key.id, new Date());
  }
}
