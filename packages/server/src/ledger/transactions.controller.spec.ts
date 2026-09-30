import { BadRequestException, ConflictException } from '@nestjs/common';
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
import { ServiceEntity } from '../services/entities/service.entity.js';
import {
  createTestApp,
  mockApiKey,
  type TestApp,
} from '../test/create-test-app.js';
import { transactionFixture } from '../test/fixtures.js';
import { ServiceTransactionsController } from './service-transactions.controller.js';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';

describe('Transactions controllers', () => {
  const transactions = {
    record: vi.fn(),
    summary: vi.fn(),
    summaryForUser: vi.fn(),
    list: vi.fn(),
    listForUser: vi.fn(),
    reverse: vi.fn(),
    findOne: vi.fn(),
    listForOrder: vi.fn(),
    findOneForUser: vi.fn(),
    listForOrderForUser: vi.fn(),
  };
  let t: TestApp;
  let apiKey: string;

  const service = {
    id: 'svc_1',
    slug: 'airtime-svc',
    name: 'MTN Airtime Service',
  };

  const sale = {
    externalId: 'sale-1',
    occurredAt: '2026-09-15T12:00:00.000Z',
    description: 'Bundle sale',
    entries: [
      { accountCode: 'cash', direction: 'DEBIT', amount: 350000 },
      { accountCode: 'vat_payable', direction: 'CREDIT', amount: 24419 },
      { accountCode: 'bundle_revenue', direction: 'CREDIT', amount: 325581 },
    ],
  };

  beforeAll(async () => {
    t = await createTestApp({
      controllers: [TransactionsController, ServiceTransactionsController],
      providers: [{ provide: TransactionsService, useValue: transactions }],
    });
  });

  afterAll(() => t.app.close());

  beforeEach(() => {
    vi.resetAllMocks();
    apiKey = mockApiKey(t.prisma, service);
  });

  describe('POST /orders/:orderId/transactions', () => {
    it('records a transaction for the calling service', async () => {
      transactions.record.mockResolvedValue({
        duplicate: false,
        transaction: transactionFixture(),
      });

      const res = await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .set('x-api-key', apiKey)
        .send(sale)
        .expect(201);

      const [calledService, orderId, dto] = transactions.record.mock.calls[0];
      expect(calledService).toBeInstanceOf(ServiceEntity);
      expect(calledService.id).toBe(service.id);
      expect(calledService.baseCurrency.code).toBe('NGN');
      expect(orderId).toBe('ord_1');
      expect(dto).toEqual(sale);

      expect(res.body.transaction.entries[0]).toEqual({
        id: 'ent_0',
        accountCode: 'cash',
        accountName: 'cash',
        direction: 'DEBIT',
        amount: { amount: '350000', currency: 'NGN' },
        baseAmount: { amount: '350000', currency: 'NGN' },
      });
      expect(res.body.transaction.exchangeRate).toBe('1');
    });

    it('accepts a foreign currency with an exchange rate', async () => {
      transactions.record.mockResolvedValue({
        duplicate: false,
        transaction: transactionFixture(),
      });

      await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .set('x-api-key', apiKey)
        .send({ ...sale, currency: 'USD', exchangeRate: '1550.25' })
        .expect(201);
    });

    it.each([
      ['a single entry', { entries: [sale.entries[0]] }],
      [
        'a bad direction',
        {
          entries: [
            sale.entries[0],
            { ...sale.entries[1], direction: 'SIDEWAYS' },
          ],
        },
      ],
      [
        'a zero amount',
        { entries: [sale.entries[0], { ...sale.entries[1], amount: 0 }] },
      ],
      [
        'a fractional amount',
        { entries: [sale.entries[0], { ...sale.entries[1], amount: 1.5 }] },
      ],
      ['an unknown currency', { currency: 'XYZ' }],
      ['a malformed exchange rate', { currency: 'USD', exchangeRate: '1,550' }],
      ['a numeric exchange rate', { currency: 'USD', exchangeRate: 1550 }],
      ['a missing externalId', { externalId: undefined }],
    ])('returns 400 for %s', async (_label, override) => {
      await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .set('x-api-key', apiKey)
        .send({ ...sale, ...override })
        .expect(400);

      expect(transactions.record).not.toHaveBeenCalled();
    });

    it('surfaces an unbalanced transaction as 400 with the reason', async () => {
      transactions.record.mockRejectedValue(
        new BadRequestException(
          'Debits (350000 NGN) do not equal credits (349999 NGN)',
        ),
      );

      const res = await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .set('x-api-key', apiKey)
        .send(sale)
        .expect(400);

      expect(res.body.message).toContain('do not equal credits');
    });

    it('returns 401 without x-api-key', async () => {
      await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .send(sale)
        .expect(401);
    });
  });

  describe('POST /transactions', () => {
    it('records a transaction without an order', async () => {
      transactions.record.mockResolvedValue({
        duplicate: false,
        transaction: transactionFixture(),
      });

      await request(t.app.getHttpServer())
        .post('/transactions')
        .set('x-api-key', apiKey)
        .send({ ...sale, currency: 'NGN' })
        .expect(201);

      const [, orderId, dto] = transactions.record.mock.calls[0];
      expect(orderId).toBeNull();
      expect(dto).toEqual({ ...sale, currency: 'NGN' });
    });

    it('passes an orderId from the body through', async () => {
      transactions.record.mockResolvedValue({
        duplicate: false,
        transaction: transactionFixture(),
      });

      await request(t.app.getHttpServer())
        .post('/transactions')
        .set('x-api-key', apiKey)
        .send({ ...sale, orderId: 'ord_1' })
        .expect(201);

      const [, orderId, dto] = transactions.record.mock.calls[0];
      expect(orderId).toBe('ord_1');
      expect(dto).not.toHaveProperty('orderId');
    });

    it('rejects orderId in the body of the order-scoped route', async () => {
      await request(t.app.getHttpServer())
        .post('/orders/ord_1/transactions')
        .set('x-api-key', apiKey)
        .send({ ...sale, orderId: 'ord_2' })
        .expect(400);
    });
  });

  it('GET /orders/:orderId/summary returns the order ledger summary', async () => {
    transactions.summary.mockResolvedValue({ fullyRecognised: true });

    const res = await request(t.app.getHttpServer())
      .get('/orders/ord_1/summary')
      .set('x-api-key', apiKey)
      .expect(200);

    expect(transactions.summary.mock.calls[0][0]).toBeInstanceOf(ServiceEntity);
    expect(transactions.summary.mock.calls[0][1]).toBe('ord_1');
    expect(res.body.fullyRecognised).toBe(true);
  });

  it('GET /services/:serviceId/orders/:orderId/summary (dashboard)', async () => {
    transactions.summaryForUser.mockResolvedValue({ fullyRecognised: false });

    await request(t.app.getHttpServer())
      .get('/services/svc_1/orders/ord_1/summary')
      .set('Authorization', t.bearer('usr_1'))
      .expect(200);

    expect(transactions.summaryForUser).toHaveBeenCalledWith(
      'svc_1',
      'usr_1',
      'ord_1',
    );
  });

  it('GET /transactions lists them with paging', async () => {
    transactions.list.mockResolvedValue({ transactions: [], nextCursor: null });

    await request(t.app.getHttpServer())
      .get('/transactions?limit=5')
      .set('x-api-key', apiKey)
      .expect(200);

    expect(transactions.list).toHaveBeenCalledWith(service.id, { limit: 5 });
  });

  it('GET /orders/:orderId/transactions lists them', async () => {
    transactions.listForOrder.mockResolvedValue([transactionFixture()]);

    const res = await request(t.app.getHttpServer())
      .get('/orders/ord_1/transactions')
      .set('x-api-key', apiKey)
      .expect(200);

    expect(transactions.listForOrder).toHaveBeenCalledWith(service.id, 'ord_1');
    expect(res.body).toHaveLength(1);
  });

  it('GET /transactions/:id returns one', async () => {
    transactions.findOne.mockResolvedValue(transactionFixture());

    await request(t.app.getHttpServer())
      .get('/transactions/txn_1')
      .set('x-api-key', apiKey)
      .expect(200);

    expect(transactions.findOne).toHaveBeenCalledWith(service.id, 'txn_1');
  });

  describe('POST /transactions/:id/reverse', () => {
    it('reverses a transaction', async () => {
      transactions.reverse.mockResolvedValue({
        duplicate: false,
        transaction: transactionFixture({
          id: 'txn_2',
          reversesTransactionId: 'txn_1',
        }),
      });

      const res = await request(t.app.getHttpServer())
        .post('/transactions/txn_1/reverse')
        .set('x-api-key', apiKey)
        .send({ externalId: 'sale-1-reversal' })
        .expect(201);

      expect(transactions.reverse.mock.calls[0][1]).toBe('txn_1');
      expect(transactions.reverse.mock.calls[0][2]).toEqual({
        externalId: 'sale-1-reversal',
      });
      expect(res.body.transaction.reversesTransactionId).toBe('txn_1');
    });

    it('returns 409 when already reversed', async () => {
      transactions.reverse.mockRejectedValue(
        new ConflictException('This transaction has already been reversed'),
      );

      await request(t.app.getHttpServer())
        .post('/transactions/txn_1/reverse')
        .set('x-api-key', apiKey)
        .send({ externalId: 'sale-1-reversal-2' })
        .expect(409);
    });

    it('returns 400 without an externalId', async () => {
      await request(t.app.getHttpServer())
        .post('/transactions/txn_1/reverse')
        .set('x-api-key', apiKey)
        .send({})
        .expect(400);
    });
  });

  describe('dashboard', () => {
    it('GET /services/:serviceId/orders/:orderId/transactions', async () => {
      transactions.listForOrderForUser.mockResolvedValue([]);

      await request(t.app.getHttpServer())
        .get('/services/svc_1/orders/ord_1/transactions')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(transactions.listForOrderForUser).toHaveBeenCalledWith(
        'svc_1',
        'usr_1',
        'ord_1',
      );
    });

    it('GET /services/:serviceId/transactions', async () => {
      transactions.listForUser.mockResolvedValue({
        transactions: [],
        nextCursor: null,
      });

      await request(t.app.getHttpServer())
        .get('/services/svc_1/transactions')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(transactions.listForUser).toHaveBeenCalledWith(
        'svc_1',
        'usr_1',
        {},
      );
    });

    it('GET /services/:serviceId/transactions/:id', async () => {
      transactions.findOneForUser.mockResolvedValue(transactionFixture());

      await request(t.app.getHttpServer())
        .get('/services/svc_1/transactions/txn_1')
        .set('Authorization', t.bearer('usr_1'))
        .expect(200);

      expect(transactions.findOneForUser).toHaveBeenCalledWith(
        'svc_1',
        'usr_1',
        'txn_1',
      );
    });

    it('returns 401 without a bearer token', async () => {
      await request(t.app.getHttpServer())
        .get('/services/svc_1/transactions/txn_1')
        .expect(401);
    });
  });
});
