import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const presented = request.headers['x-api-key'];

    if (typeof presented !== 'string' || presented.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const parts = presented.split('_');

    if (parts.length !== 4 || parts[0] !== 'sk' || parts[1] !== 'live') {
      throw new UnauthorizedException('Invalid API key');
    }

    const [, , publicId, secret] = parts;

    const key = await this.prisma.apiKey.findUnique({
      where: { publicId },
      include: { service: true },
    });

    if (!key || key.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    const presentedHash = createHash('sha256').update(secret).digest();
    const storedHash = Buffer.from(key.secretHash, 'hex');

    const matches =
      presentedHash.length === storedHash.length &&
      timingSafeEqual(presentedHash, storedHash);

    if (!matches) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();
    const stale =
      !key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > 300_000;

    if (stale) {
      void this.prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: now } })
        .catch(() => undefined);
    }

    request.service = key.service;
    return true;
  }
}
