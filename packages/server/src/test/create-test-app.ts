import {
  INestApplication,
  Provider,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes } from 'node:crypto';
import { vi } from 'vitest';
import { AuthGuard } from '../identity/auth.guard.js';
import { UserRepository } from '../identity/user.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiKeyGuard } from '../services/api-key.guard.js';
import { ApiKeyRepository } from '../services/api-key.repository.js';
import { RolesGuard } from '../services/roles.guard.js';

const JWT_SECRET = 'test-secret';

export function createPrismaMock() {
  return {
    apiKey: { findUnique: vi.fn(), update: vi.fn(() => Promise.resolve({})) },
    user: { findUnique: vi.fn() },
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export interface TestApp {
  app: INestApplication;
  prisma: PrismaMock;
  bearer: (sub: string, email?: string) => string;
}

/**
 * Boots the given controllers over HTTP with the real guards and the same
 * global ValidationPipe as main.ts. Domain services are supplied as mocks.
 */
export async function createTestApp(options: {
  controllers: Type<unknown>[];
  providers?: Provider[];
}): Promise<TestApp> {
  const prisma = createPrismaMock();

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: JWT_SECRET })],
    controllers: options.controllers,
    providers: [
      AuthGuard,
      ApiKeyGuard,
      RolesGuard,
      // Real repositories over a mocked Prisma, so the guards run unchanged.
      UserRepository,
      ApiKeyRepository,
      { provide: PrismaService, useValue: prisma },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const jwt = moduleRef.get(JwtService);
  const bearer = (sub: string, email = `${sub}@mtn.test`) =>
    `Bearer ${jwt.sign({ sub, email })}`;

  return { app, prisma, bearer };
}

/**
 * Stubs the API key lookup so ApiKeyGuard accepts the returned key and
 * attaches `service` to the request.
 */
export function mockApiKey(
  prisma: PrismaMock,
  service: { id: string; slug: string; name: string; [field: string]: unknown },
  opts: { revoked?: boolean } = {},
) {
  const publicId = randomBytes(8).toString('hex');
  const secret = randomBytes(32).toString('hex');

  prisma.apiKey.findUnique.mockResolvedValue({
    id: 'key_1',
    name: 'test key',
    serviceId: service.id,
    createdAt: new Date(),
    publicId,
    secretHash: createHash('sha256').update(secret).digest('hex'),
    revokedAt: opts.revoked ? new Date() : null,
    lastUsedAt: new Date(),
    service: {
      baseCurrency: 'NGN',
      ownerId: 'usr_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...service,
    },
  });

  return `sk_live_${publicId}_${secret}`;
}

export function asRole(prisma: PrismaMock, role: 'ADMIN' | 'MEMBER') {
  prisma.user.findUnique.mockResolvedValue({ role });
}
