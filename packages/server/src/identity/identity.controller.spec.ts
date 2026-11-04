import { ConflictException, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createTestApp, type TestApp } from '../test/create-test-app.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

describe('IdentityController', () => {
  const identity = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [IdentityController],
      providers: [{ provide: IdentityService, useValue: identity }],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => vi.clearAllMocks());

  const user = {
    email: 'user_1@mtn.test',
    password: 'Password123!',
    name: 'Jane Doe',
  };

  describe('POST /auth/register', () => {
    it('creates a user without exposing passwordHash', async () => {
      identity.register.mockResolvedValue({
        id: 'usr_1',
        email: user.email,
        name: user.name,
      });

      const res = await request(t.app.getHttpServer())
        .post('/auth/register')
        .send(user)
        .expect(201);

      expect(identity.register).toHaveBeenCalledWith(user);
      expect(res.body).toEqual({
        id: 'usr_1',
        email: user.email,
        name: user.name,
      });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('returns 409 for a duplicate email', async () => {
      identity.register.mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      await request(t.app.getHttpServer())
        .post('/auth/register')
        .send({ ...user, name: 'Duplicate User' })
        .expect(409);
    });

    it.each([
      ['an invalid email', { ...user, email: 'not-an-email' }],
      ['a short password', { ...user, password: 'short' }],
      ['a short name', { ...user, name: 'J' }],
      ['an unknown field', { ...user, role: 'ADMIN' }],
    ])('returns 400 for %s', async (_label, body) => {
      await request(t.app.getHttpServer())
        .post('/auth/register')
        .send(body)
        .expect(400);

      expect(identity.register).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with an access token', async () => {
      identity.login.mockResolvedValue({ access_token: 'jwt.token.here' });

      const res = await request(t.app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(identity.login).toHaveBeenCalledWith({
        email: user.email,
        password: user.password,
      });
      expect(res.body.access_token).toBe('jwt.token.here');
    });

    it('returns 401 for a wrong password', async () => {
      identity.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await request(t.app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'incorrectpassword' })
        .expect(401);
    });

    it('returns 400 when the email is malformed', async () => {
      await request(t.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope', password: user.password })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 200 with the new tokens', async () => {
      const tokens = {
        access_token: 'jwt.token.here',
        refresh_token: 'next-token',
        refresh_expires_in: 604800,
      };
      identity.refresh.mockResolvedValue(tokens);

      const res = await request(t.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'current-token' })
        .expect(200);

      expect(identity.refresh).toHaveBeenCalledWith('current-token');
      expect(res.body).toEqual(tokens);
    });

    it('returns 401 when the token is rejected', async () => {
      identity.refresh.mockRejectedValue(new UnauthorizedException());

      await request(t.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'spent-token' })
        .expect(401);
    });

    it.each([
      ['a missing token', {}],
      ['an empty token', { refresh_token: '' }],
      ['a non-string token', { refresh_token: 1 }],
    ])('returns 400 for %s', async (_label, body) => {
      await request(t.app.getHttpServer())
        .post('/auth/refresh')
        .send(body)
        .expect(400);

      expect(identity.refresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 with no body', async () => {
      identity.logout.mockResolvedValue(undefined);

      const res = await request(t.app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: 'current-token' })
        .expect(204);

      expect(identity.logout).toHaveBeenCalledWith('current-token');
      expect(res.body).toEqual({});
    });

    it('returns 400 for a missing token', async () => {
      await request(t.app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(400);
    });
  });
});
