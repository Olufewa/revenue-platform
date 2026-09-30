import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asRole,
  createTestApp,
  mockApiKey,
  type TestApp,
} from '../test/create-test-app.js';
import { ApiKeysService } from './api-keys.service.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

describe('ServicesController', () => {
  const services = {
    create: vi.fn(),
    findAllFor: vi.fn(),
    findOneFor: vi.fn(),
    remove: vi.fn(),
  };
  const apiKeys = { create: vi.fn(), findAll: vi.fn(), revoke: vi.fn() };
  let t: TestApp;

  const service = {
    id: 'svc_1',
    name: 'MTN Airtime Service',
    slug: 'mtn-airtime-service-1a2b3c4d',
  };

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [ServicesController],
      providers: [
        { provide: ServicesService, useValue: services },
        { provide: ApiKeysService, useValue: apiKeys },
      ],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => vi.resetAllMocks());

  describe('POST /services', () => {
    it('creates a service with a generated slug', async () => {
      services.create.mockResolvedValue(service);

      const res = await request(t.app.getHttpServer())
        .post('/services')
        .set('Authorization', t.bearer('usr_1'))
        .send({ name: service.name, baseCurrency: 'NGN' })
        .expect(201);

      expect(services.create).toHaveBeenCalledWith(
        { name: service.name, baseCurrency: 'NGN' },
        'usr_1',
      );
      expect(res.body.id).toBe(service.id);
      expect(res.body.slug).toBe(service.slug);
    });

    it('rejects a client-supplied slug', async () => {
      await request(t.app.getHttpServer())
        .post('/services')
        .set('Authorization', t.bearer('usr_1'))
        .send({ name: service.name, baseCurrency: 'NGN', slug: 'my-slug' })
        .expect(400);

      expect(services.create).not.toHaveBeenCalled();
    });

    it('returns 400 for a name that is too short', async () => {
      await request(t.app.getHttpServer())
        .post('/services')
        .set('Authorization', t.bearer('usr_1'))
        .send({ name: 'A', baseCurrency: 'NGN' })
        .expect(400);
    });

    it.each([
      ['a missing base currency', {}],
      ['an unknown base currency', { baseCurrency: 'XYZ' }],
      ['a lowercase base currency', { baseCurrency: 'ngn' }],
    ])('returns 400 for %s', async (_label, extra) => {
      await request(t.app.getHttpServer())
        .post('/services')
        .set('Authorization', t.bearer('usr_1'))
        .send({ name: service.name, ...extra })
        .expect(400);

      expect(services.create).not.toHaveBeenCalled();
    });

    it('returns 401 without a bearer token', async () => {
      await request(t.app.getHttpServer())
        .post('/services')
        .send({ name: service.name })
        .expect(401);
    });

    it('returns 401 with an invalid bearer token', async () => {
      await request(t.app.getHttpServer())
        .post('/services')
        .set('Authorization', 'Bearer not-a-jwt')
        .send({ name: service.name })
        .expect(401);
    });
  });

  describe('GET /services', () => {
    it('lists the caller’s services', async () => {
      services.findAllFor.mockResolvedValue([service]);

      const res = await request(t.app.getHttpServer())
        .get('/services')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(services.findAllFor).toHaveBeenCalledWith('usr_1');
      expect(res.body).toEqual([service]);
    });
  });

  describe('GET /services/:id', () => {
    it('returns the service', async () => {
      services.findOneFor.mockResolvedValue(service);

      const res = await request(t.app.getHttpServer())
        .get(`/services/${service.id}`)
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(services.findOneFor).toHaveBeenCalledWith(service.id, 'usr_1');
      expect(res.body).toEqual(service);
    });
  });

  describe('API keys', () => {
    it('POST /services/:id/keys mints a key', async () => {
      const minted = {
        id: 'key_1',
        key: `sk_live_${'a'.repeat(16)}_${'b'.repeat(64)}`,
        prefix: 'sk_live_aaaa',
      };
      apiKeys.create.mockResolvedValue(minted);

      const res = await request(t.app.getHttpServer())
        .post(`/services/${service.id}/keys`)
        .set('Authorization', t.bearer('usr_1'))
        .send({ name: 'Test Key for Revocation' })
        .expect(201);

      expect(apiKeys.create).toHaveBeenCalledWith(service.id, 'usr_1', {
        name: 'Test Key for Revocation',
      });
      expect(res.body.key).toMatch(/^sk_live_[a-f0-9]{16}_[a-f0-9]{64}$/);
    });

    it('POST /services/:id/keys returns 400 without a name', async () => {
      await request(t.app.getHttpServer())
        .post(`/services/${service.id}/keys`)
        .set('Authorization', t.bearer('usr_1'))
        .send({})
        .expect(400);
    });

    it('GET /services/:id/keys lists key metadata', async () => {
      apiKeys.findAll.mockResolvedValue([
        { id: 'key_1', name: 'k', prefix: 'sk_live_aaaa', active: true },
      ]);

      const res = await request(t.app.getHttpServer())
        .get(`/services/${service.id}/keys`)
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(apiKeys.findAll).toHaveBeenCalledWith(service.id, 'usr_1');
      expect(res.body[0].prefix).toBe('sk_live_aaaa');
    });

    it('DELETE /services/:id/keys/:keyId revokes the key', async () => {
      const revokedAt = new Date().toISOString();
      apiKeys.revoke.mockResolvedValue({ id: 'key_1', active: false, revokedAt });

      const res = await request(t.app.getHttpServer())
        .delete(`/services/${service.id}/keys/key_1`)
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(apiKeys.revoke).toHaveBeenCalledWith(service.id, 'key_1', 'usr_1');
      expect(res.body.active).toBe(false);
      expect(res.body.revokedAt).toBe(revokedAt);
    });
  });

  describe('GET /services/whoami', () => {
    it('identifies the service from x-api-key', async () => {
      // The guard attaches the full record; whoami must only expose id/slug/name.
      const record = { ...service, ownerId: 'usr_1', createdAt: new Date() };
      const key = mockApiKey(t.prisma, record);

      const res = await request(t.app.getHttpServer())
        .get('/services/whoami')
        .set('x-api-key', key)
        .expect(200);

      expect(res.body).toEqual(service);
    });

    it('returns 401 without x-api-key', async () => {
      await request(t.app.getHttpServer()).get('/services/whoami').expect(401);
    });

    it('returns 401 for a revoked key', async () => {
      const key = mockApiKey(t.prisma, service, { revoked: true });

      await request(t.app.getHttpServer())
        .get('/services/whoami')
        .set('x-api-key', key)
        .expect(401);
    });

    it('returns 401 when the secret does not match', async () => {
      const key = mockApiKey(t.prisma, service);
      const tampered = key.slice(0, -1) + (key.endsWith('0') ? '1' : '0');

      await request(t.app.getHttpServer())
        .get('/services/whoami')
        .set('x-api-key', tampered)
        .expect(401);
    });

    it('returns 401 for a malformed key', async () => {
      await request(t.app.getHttpServer())
        .get('/services/whoami')
        .set('x-api-key', 'garbage')
        .expect(401);
    });
  });

  describe('DELETE /services/:id', () => {
    it('returns 403 for a member', async () => {
      asRole(t.prisma, 'MEMBER');

      await request(t.app.getHttpServer())
        .delete(`/services/${service.id}`)
        .set('Authorization', t.bearer('usr_1'))
        .expect(403);

      expect(services.remove).not.toHaveBeenCalled();
    });

    it('returns 204 for an admin', async () => {
      asRole(t.prisma, 'ADMIN');
      services.remove.mockResolvedValue(undefined);

      await request(t.app.getHttpServer())
        .delete(`/services/${service.id}`)
        .set('Authorization', t.bearer('usr_admin'))
        .expect(204);

      expect(services.remove).toHaveBeenCalledWith(service.id, 'usr_admin');
    });
  });
});
