import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on the route means any signed-in user may call it.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const payload = request.user;

    if (!payload?.sub) {
      throw new UnauthorizedException('Missing bearer token');
    }

    // The role is read from the database, not from the token. A token lives
    // for a day; if someone is demoted this morning their old token should
    // stop working now, not tomorrow. One extra query is the price of that.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true },
    });

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('You do not have access to this');
    }

    return true;
  }
}
