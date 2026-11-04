import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AppModule } from '../src/app.module.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Sessions (real database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Password123!';
  let email: string;

  const http = () => request(app.getHttpServer());
  const login = async () =>
    (await http().post('/auth/login').send({ email, password }).expect(200))
      .body;
  const refresh = (token: string) =>
    http().post('/auth/refresh').send({ refresh_token: token });
  const claims = (jwt: string) =>
    JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

  /** Ages a token's rotation past the grace window, without waiting for it. */
  const ageRotation = (familyId?: string) =>
    prisma.refreshToken.updateMany({
      where: { rotatedAt: { not: null }, ...(familyId ? { familyId } : {}) },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    email = `sessions_${Date.now()}@mtn.test`;
    await http()
      .post('/auth/register')
      .send({ email, password, name: 'Sessions' })
      .expect(201);
  });

  afterAll(() => app.close());

  it('issues a 15-minute access token and a refresh token', async () => {
    const tokens = await login();
    const { iat, exp } = claims(tokens.access_token);

    expect(exp - iat).toBe(15 * 60);
    expect(tokens.refresh_token).toEqual(expect.any(String));
    expect(tokens.refresh_expires_in).toBe(7 * 24 * 60 * 60);
  });

  it('never stores the refresh token itself', async () => {
    const { refresh_token } = await login();
    const rows = await prisma.refreshToken.findMany();

    expect(JSON.stringify(rows)).not.toContain(refresh_token);
  });

  it('exchanges a refresh token for a working pair', async () => {
    const first = await login();
    const res = await refresh(first.refresh_token).expect(200);

    expect(res.body.refresh_token).not.toBe(first.refresh_token);
    await http()
      .get('/services')
      .set('Authorization', `Bearer ${res.body.access_token}`)
      .expect(200);
    await refresh(res.body.refresh_token).expect(200);
  });

  it('allows a repeat inside the grace window', async () => {
    const { refresh_token } = await login();

    await refresh(refresh_token).expect(200);
    await refresh(refresh_token).expect(200);
  });

  it('handles parallel refreshes of the same token', async () => {
    const { refresh_token } = await login();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => refresh(refresh_token)),
    );

    expect(results.map((res) => res.status)).toEqual(Array(5).fill(200));
  });

  it('on a replay, revokes the whole family and commits that', async () => {
    const first = await login();
    const second = (await refresh(first.refresh_token).expect(200)).body;
    const row = await prisma.refreshToken.findFirstOrThrow({
      where: { rotatedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    await ageRotation(row.familyId);

    await refresh(first.refresh_token).expect(401);

    // The newest token worked a moment ago, so this proves the revocation stuck.
    await refresh(second.refresh_token).expect(401);
    const live = await prisma.refreshToken.count({
      where: { familyId: row.familyId, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('leaves other sessions alone when one is revoked', async () => {
    const deviceA = await login();
    const deviceB = await login();

    await http()
      .post('/auth/logout')
      .send({ refresh_token: deviceA.refresh_token })
      .expect(204);

    await refresh(deviceA.refresh_token).expect(401);
    await refresh(deviceB.refresh_token).expect(200);
  });

  it('rejects an expired token and an unknown one', async () => {
    const { refresh_token } = await login();
    await prisma.refreshToken.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await refresh(refresh_token).expect(401);
    await refresh('never-issued').expect(401);
  });

  it('removes expired tokens at the next login', async () => {
    await prisma.refreshToken.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await login();

    expect(
      await prisma.refreshToken.count({
        where: { user: { email }, expiresAt: { lte: new Date() } },
      }),
    ).toBe(0);
  });

  it('returns 204 when logging out with an unknown token', async () => {
    await http()
      .post('/auth/logout')
      .send({ refresh_token: 'never-issued' })
      .expect(204);
  });

  it('removes tokens when the user is deleted', async () => {
    await login();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await prisma.user.delete({ where: { id: user.id } });

    expect(
      await prisma.refreshToken.count({ where: { userId: user.id } }),
    ).toBe(0);
  });
});
