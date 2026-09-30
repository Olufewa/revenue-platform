import { ConflictException } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp, type TestApp } from '../test/create-test-app.js';
import { accountFixture } from '../test/fixtures.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsController', () => {
  const accounts = { create: vi.fn(), list: vi.fn() };
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: accounts }],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => vi.resetAllMocks());

  const cash = { code: 'cash', name: 'Cash received', type: 'ASSET' };

  describe('POST /services/:serviceId/accounts', () => {
    it('creates an account', async () => {
      accounts.create.mockResolvedValue(accountFixture('cash', 'ASSET'));

      const res = await request(t.app.getHttpServer())
        .post('/services/svc_1/accounts')
        .set('Authorization', t.bearer('usr_1'))
        .send(cash)
        .expect(201);

      expect(accounts.create).toHaveBeenCalledWith('svc_1', 'usr_1', cash);
      expect(res.body).toMatchObject({ id: 'acc_cash', code: 'cash', type: 'ASSET' });
    });

    it.each([
      ['an uppercase code', { ...cash, code: 'Cash' }],
      ['a code with spaces', { ...cash, code: 'cash in' }],
      ['an unknown type', { ...cash, type: 'REVENUE' }],
      ['a missing name', { code: 'cash', type: 'ASSET' }],
    ])('returns 400 for %s', async (_label, body) => {
      await request(t.app.getHttpServer())
        .post('/services/svc_1/accounts')
        .set('Authorization', t.bearer('usr_1'))
        .send(body)
        .expect(400);

      expect(accounts.create).not.toHaveBeenCalled();
    });

    it('returns 409 for a duplicate code', async () => {
      accounts.create.mockRejectedValue(new ConflictException('Account "cash" already exists'));

      await request(t.app.getHttpServer())
        .post('/services/svc_1/accounts')
        .set('Authorization', t.bearer('usr_1'))
        .send(cash)
        .expect(409);
    });

    it('returns 401 without a bearer token', async () => {
      await request(t.app.getHttpServer()).post('/services/svc_1/accounts').send(cash).expect(401);
    });
  });

  it('GET /services/:serviceId/accounts lists the chart of accounts', async () => {
    accounts.list.mockResolvedValue([
      accountFixture('bundle_revenue', 'INCOME'),
      accountFixture('cash', 'ASSET'),
    ]);

    const res = await request(t.app.getHttpServer())
      .get('/services/svc_1/accounts')
      .set('Authorization', t.bearer('usr_1'))
      .expect(200);

    expect(accounts.list).toHaveBeenCalledWith('svc_1', 'usr_1');
    expect(res.body.map((a: { code: string }) => a.code)).toEqual(['bundle_revenue', 'cash']);
  });
});
