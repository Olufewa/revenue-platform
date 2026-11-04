import { NotFoundException } from '@nestjs/common';
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
import {
  createTestApp,
  mockApiKey,
  type TestApp,
} from '../test/create-test-app.js';
import { orderFixture } from '../test/fixtures.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ServiceOrdersController } from './service-orders.controller.js';

describe('Orders controllers', () => {
  const orders = {
    create: vi.fn(),
    list: vi.fn(),
    findOne: vi.fn(),
    listForUser: vi.fn(),
    findOneForUser: vi.fn(),
  };
  let t: TestApp;
  let apiKey: string;

  const service = {
    id: 'svc_1',
    slug: 'airtime-svc',
    name: 'MTN Airtime Service',
  };

  const payload = {
    externalId: 'bundle-3500-1',
    amount: 350000,
    currency: 'NGN',
    placedAt: '2026-09-15T12:00:00.000Z',
    description: '1GB data bundle',
    customerRef: '+2348030001234',
    metadata: { channel: 'ussd' },
  };

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [OrdersController, ServiceOrdersController],
      providers: [{ provide: OrdersService, useValue: orders }],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => {
    vi.resetAllMocks();
    apiKey = mockApiKey(t.prisma, service);
  });

  describe('POST /orders', () => {
    it('records an order and returns its total as Money', async () => {
      orders.create.mockResolvedValue({
        duplicate: false,
        order: orderFixture(),
      });

      const res = await request(t.app.getHttpServer())
        .post('/orders')
        .set('x-api-key', apiKey)
        .send(payload)
        .expect(201);

      expect(orders.create).toHaveBeenCalledWith(service.id, payload);
      expect(res.body.duplicate).toBe(false);
      expect(res.body.order.total).toEqual({
        amount: '350000',
        currency: 'NGN',
      });
    });

    it('passes duplicates through', async () => {
      orders.create.mockResolvedValue({
        duplicate: true,
        order: orderFixture(),
      });

      const res = await request(t.app.getHttpServer())
        .post('/orders')
        .set('x-api-key', apiKey)
        .send(payload)
        .expect(201);

      expect(res.body.duplicate).toBe(true);
    });

    it.each([
      ['an unknown currency', { currency: 'XYZ' }],
      ['a fractional amount', { amount: 12.5 }],
      ['a zero amount', { amount: 0 }],
      ['a non-ISO placedAt', { placedAt: 'yesterday' }],
      ['an unknown field', { status: 'PAID' }],
    ])('returns 400 for %s', async (_label, override) => {
      await request(t.app.getHttpServer())
        .post('/orders')
        .set('x-api-key', apiKey)
        .send({ ...payload, ...override })
        .expect(400);

      expect(orders.create).not.toHaveBeenCalled();
    });

    it('returns 401 without x-api-key', async () => {
      await request(t.app.getHttpServer())
        .post('/orders')
        .send(payload)
        .expect(401);
    });

    it('returns 401 with a bearer token instead of an API key', async () => {
      await request(t.app.getHttpServer())
        .post('/orders')
        .set('Authorization', t.bearer('usr_1'))
        .send(payload)
        .expect(401);
    });
  });

  describe('GET /orders', () => {
    it('lists orders with a numeric limit', async () => {
      orders.list.mockResolvedValue({
        orders: [orderFixture()],
        nextCursor: null,
      });

      const res = await request(t.app.getHttpServer())
        .get('/orders?limit=10&cursor=ord_0')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(orders.list).toHaveBeenCalledWith(service.id, {
        limit: 10,
        cursor: 'ord_0',
      });
      expect(res.body.orders[0].id).toBe('ord_1');
    });

    it('returns 400 when limit is out of range', async () => {
      await request(t.app.getHttpServer())
        .get('/orders?limit=500')
        .set('x-api-key', apiKey)
        .expect(400);
    });
  });

  describe('GET /orders/:id', () => {
    it('returns the order', async () => {
      orders.findOne.mockResolvedValue(orderFixture());

      await request(t.app.getHttpServer())
        .get('/orders/ord_1')
        .set('x-api-key', apiKey)
        .expect(200);

      expect(orders.findOne).toHaveBeenCalledWith(service.id, 'ord_1');
    });

    it('returns 404 for an order on another service', async () => {
      orders.findOne.mockRejectedValue(new NotFoundException());

      await request(t.app.getHttpServer())
        .get('/orders/ord_x')
        .set('x-api-key', apiKey)
        .expect(404);
    });
  });

  describe('dashboard', () => {
    it('GET /services/:serviceId/orders lists for the user', async () => {
      orders.listForUser.mockResolvedValue({ orders: [], nextCursor: null });

      await request(t.app.getHttpServer())
        .get('/services/svc_1/orders?limit=5')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(orders.listForUser).toHaveBeenCalledWith('svc_1', 'usr_1', {
        limit: 5,
      });
    });

    it('GET /services/:serviceId/orders/:orderId returns one order', async () => {
      orders.findOneForUser.mockResolvedValue(orderFixture());

      await request(t.app.getHttpServer())
        .get('/services/svc_1/orders/ord_1')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(orders.findOneForUser).toHaveBeenCalledWith(
        'svc_1',
        'usr_1',
        'ord_1',
      );
    });

    it('returns 401 without a bearer token', async () => {
      await request(t.app.getHttpServer())
        .get('/services/svc_1/orders')
        .expect(401);
    });
  });
});
