import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '../identity/user.repository.js';
import { isUniqueViolation } from '../prisma/db-client.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { ServiceEntity } from './entities/service.entity.js';
import { ServiceRepository } from './service.repository.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly users: UserRepository,
  ) {}

  async create(dto: CreateServiceDto, ownerId: string) {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const slug = ServiceEntity.generateSlug(dto.name);

      try {
        if (await this.services.existsBySlug(slug)) {
          if (attempt === MAX_RETRIES) {
            throw new ConflictException(
              'Failed to generate a unique slug after 3 attempts.',
            );
          }
          continue;
        }

        return await this.services.create({
          name: dto.name,
          slug,
          baseCurrency: dto.baseCurrency,
          timezone: dto.timezone,
          ownerId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          if (attempt === MAX_RETRIES) {
            throw new InternalServerErrorException(
              'Failed to generate a unique slug due to high concurrency.',
            );
          }
          continue;
        }
        throw error;
      }
    }
  }

  async findAllFor(userId: string) {
    const role = await this.users.findRole(userId);

    return this.services.findNewestFirst(role === 'ADMIN' ? undefined : userId);
  }

  async findOneFor(id: string, userId: string) {
    return this.assertCanAccess(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.assertCanAccess(id, userId);

    await this.services.delete(id);
  }

  async assertCanAccess(serviceId: string, userId: string) {
    const service = await this.services.findById(serviceId);

    if (!service) {
      throw new NotFoundException('No such service');
    }

    if (service.isOwnedBy(userId)) {
      return service;
    }

    if ((await this.users.findRole(userId)) !== 'ADMIN') {
      throw new ForbiddenException('That service belongs to someone else');
    }

    return service;
  }
}
