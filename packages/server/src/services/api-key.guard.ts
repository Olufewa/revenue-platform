import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

// Machines authenticate with this guard; humans use AuthGuard and a JWT.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const presented = request.headers['x-api-key'];

    if (typeof presented !== 'string' || presented.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    // sk_live_<publicId>_<secret>
    //
    // A password is looked up by email: you know who is logging in, you fetch
    // one row, you compare. An API key gives you no such handle - the caller
    // hands you an opaque string and nothing else. Hashing it whole would
    // leave you comparing against every row in the table. So the key carries
    // its own handle: the publicId finds the row, the secret proves it.
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

    // timingSafeEqual instead of === so the comparison takes the same time
    // whether the first byte is wrong or only the last one is. A plain ===
    // returns early on the first mismatch, and that timing difference can be
    // measured and used to guess a key one byte at a time.
    const matches =
      presentedHash.length === storedHash.length &&
      timingSafeEqual(presentedHash, storedHash);

    if (!matches) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Useful on its own, and it is what will let you spot a key that has not
    // been used in six months. Not awaited: the request should not wait on a
    // bookkeeping write.
    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    request.service = key.service;
    return true;
  }
}
