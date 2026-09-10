import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto, ownerId: string) {
    const existing = await this.prisma.service.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`The slug "${dto.slug}" is already taken`);
    }

    return this.prisma.service.create({
      data: { name: dto.name, slug: dto.slug, ownerId },
    });
  }

  async findAllFor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return this.prisma.service.findMany({
      where: user?.role === 'ADMIN' ? {} : { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneFor(id: string, userId: string) {
    return this.assertCanAccess(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.assertCanAccess(id, userId);

    await this.prisma.service.delete({ where: { id } });
  }

  async assertCanAccess(serviceId: string, userId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('No such service');
    }

    if (service.ownerId === userId) {
      return service;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('That service belongs to someone else');
    }

    return service;
  }
}
