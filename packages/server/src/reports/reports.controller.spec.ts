import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp, type TestApp } from '../test/create-test-app.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController', () => {
  const reports = { balances: vi.fn(), revenue: vi.fn() };
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reports }],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => vi.resetAllMocks());

  it('GET /services/:serviceId/balances passes asOf through', async () => {
    reports.balances.mockResolvedValue({ baseCurrency: 'NGN', accounts: [] });

    await request(t.app.getHttpServer())
      .get('/services/svc_1/balances?asOf=2026-09-30')
      .set('Authorization', t.bearer('usr_1'))
      .expect(200);

    expect(reports.balances).toHaveBeenCalledWith('svc_1', 'usr_1', { asOf: '2026-09-30' });
  });

  it('GET /services/:serviceId/balances returns 400 for a bad asOf', async () => {
    await request(t.app.getHttpServer())
      .get('/services/svc_1/balances?asOf=soon')
      .set('Authorization', t.bearer('usr_1'))
      .expect(400);
  });

  it('GET /services/:serviceId/reports/revenue passes the window through', async () => {
    reports.revenue.mockResolvedValue({ baseCurrency: 'NGN', series: [] });

    await request(t.app.getHttpServer())
      .get('/services/svc_1/reports/revenue?from=2026-09-01&to=2026-09-30')
      .set('Authorization', t.bearer('usr_1'))
      .expect(200);

    expect(reports.revenue).toHaveBeenCalledWith('svc_1', 'usr_1', {
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('GET /services/:serviceId/reports/revenue returns 400 for a bad date', async () => {
    await request(t.app.getHttpServer())
      .get('/services/svc_1/reports/revenue?from=last-week')
      .set('Authorization', t.bearer('usr_1'))
      .expect(400);
  });

  it('returns 401 without a bearer token', async () => {
    await request(t.app.getHttpServer()).get('/services/svc_1/balances').expect(401);
  });
});
