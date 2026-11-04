import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepository } from './api-key.repository.js';
import { ApiKeyEntity } from './entities/api-key.entity.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const presented = request.headers['x-api-key'];

    if (typeof presented !== 'string' || presented.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const parsed = ApiKeyEntity.parse(presented);

    if (!parsed) {
      throw new UnauthorizedException('Invalid API key');
    }

    const found = await this.apiKeys.findByPublicIdWithService(parsed.publicId);

    if (
      !found ||
      !found.key.isActive ||
      !found.key.matchesSecret(parsed.secret)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    const now = new Date();

    if (found.key.isUsageStale(now)) {
      void this.apiKeys.touch(found.key.id, now).catch(() => undefined);
    }

    request.service = found.service;
    return true;
  }
}
