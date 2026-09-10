import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ServicesService } from './services.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
  ) {}

  async create(serviceId: string, userId: string, dto: CreateApiKeyDto) {
    await this.services.assertCanAccess(serviceId, userId);

    const publicId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const plainKey = `sk_live_${publicId}_${secret}`;

    const secretHash = createHash('sha256').update(secret).digest('hex');

    const key = await this.prisma.apiKey.create({
      data: { publicId, secretHash, name: dto.name, serviceId },
    });

    return {
      ...this.publicKey(key),
      key: plainKey,
      warning: 'Copy this key now. It will not be shown again.',
    };
  }

  async findAll(serviceId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const keys = await this.prisma.apiKey.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((key) => this.publicKey(key));
  }

  async revoke(serviceId: string, keyId: string, userId: string) {
    await this.services.assertCanAccess(serviceId, userId);

    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, serviceId },
    });

    if (!key) {
      throw new NotFoundException('No such API key on this service');
    }

    if (key.revokedAt) {
      return this.publicKey(key);
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    return this.publicKey(updated);
  }

  private publicKey(key: {
    id: string;
    publicId: string;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
  }) {
    return {
      id: key.id,
      name: key.name,

      prefix: `sk_live_${key.publicId}`,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      active: key.revokedAt === null,
    };
  }
}
