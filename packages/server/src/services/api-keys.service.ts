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

    // 8 random bytes for the lookup half, 32 for the secret. base64url so the
    // key survives being pasted into a URL or a header without escaping.
    const publicId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const plainKey = `sk_live_${publicId}_${secret}`;

    // sha256, not bcrypt. bcrypt is deliberately slow because passwords are
    // short and human-chosen, and slowness is what makes guessing them
    // impractical. This secret is 32 random bytes - guessing it is already
    // impossible - and it gets checked on every single ingest request, so a
    // 100ms hash would be 100ms added to every event MTN posts.
    const secretHash = createHash('sha256').update(secret).digest('hex');

    const key = await this.prisma.apiKey.create({
      data: { publicId, secretHash, name: dto.name, serviceId },
    });

    // The only time the full key ever exists outside the caller's hands.
    // It is not stored, so it cannot be shown again.
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

  // Revoke, never delete. A deleted key leaves no trace of what it did; a
  // revoked one stops working but stays in the audit trail.
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

  // The same job publicUser() does in IdentityService: one place that decides
  // what leaves the building, so secretHash can never slip into a response.
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
      // Enough to match a key against the one in your config, useless to a
      // thief without the secret half.
      prefix: `sk_live_${key.publicId}`,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      active: key.revokedAt === null,
    };
  }
}
