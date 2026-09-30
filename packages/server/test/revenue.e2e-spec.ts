import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

/**
 * The Postman flow against a real Postgres: every query, raw SQL statement and
 * migration runs for real here.
 */
describe('revenue tracker (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const stamp = Date.now();
  let bearer: string;
  let serviceId: string;
  let apiKey: string;
  let orderId: string;
  let saleId: string;

  const sale = {
    externalId: `sale-${stamp}`,
    occurredAt: '2026-09-15T12:00:00.000Z',
    description: 'Bundle sale, VAT inclusive',
    entries: [
      { accountCode: 'cash', direction: 'DEBIT', amount: 350000 },
      { accountCode: 'vat_payable', direction: 'CREDIT', amount: 24419 },
      { accountCode: 'bundle_revenue', direction: 'CREDIT', amount: 325581 },
    ],
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(() => app?.close());

  it('registers, logs in and creates a service with a key', async () => {
    const email = `e2e_${stamp}@mtn.test`;
    await request(http)
      .post('/auth/register')
      .send({ email, password: 'Password123!', name: 'E2E User' })
      .expect(201);

    const login = await request(http)
      .post('/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);
    bearer = `Bearer ${login.body.access_token}`;

    const service = await request(http)
      .post('/services')
      .set('Authorization', bearer)
      .send({ name: 'E2E Airtime', baseCurrency: 'NGN' })
      .expect(201);
    serviceId = service.body.id;
    expect(service.body.baseCurrency).toBe('NGN');
    expect(service.body.timezone).toBe('Africa/Lagos');

    const key = await request(http)
      .post(`/services/${serviceId}/keys`)
      .set('Authorization', bearer)
      .send({ name: 'e2e' })
      .expect(201);
    apiKey = key.body.key;

    await request(http).get('/services/whoami').set('x-api-key', apiKey).expect(200);
  });

  it('builds a chart of accounts', async () => {
    for (const [code, type] of [
      ['cash', 'ASSET'],
      ['vat_payable', 'LIABILITY'],
      ['bundle_revenue', 'INCOME'],
    ]) {
      await request(http)
        .post(`/services/${serviceId}/accounts`)
        .set('Authorization', bearer)
        .send({ code, name: code, type })
        .expect(201);
    }

    await request(http)
      .post(`/services/${serviceId}/accounts`)
      .set('Authorization', bearer)
      .send({ code: 'cash', name: 'again', type: 'ASSET' })
      .expect(409);
  });

  it('takes an order idempotently', async () => {
    const body = {
      externalId: `order-${stamp}`,
      amount: 350000,
      currency: 'NGN',
      placedAt: '2026-09-15T12:00:00.000Z',
      metadata: { channel: 'ussd' },
    };

    const first = await request(http).post('/orders').set('x-api-key', apiKey).send(body).expect(201);
    orderId = first.body.order.id;
    expect(first.body.order.total).toEqual({ amount: '350000', currency: 'NGN' });

    const again = await request(http).post('/orders').set('x-api-key', apiKey).send(body).expect(201);
    expect(again.body).toMatchObject({ duplicate: true, order: { id: orderId } });

    // Key order doesn't matter, but content does.
    const reordered = Object.fromEntries(Object.entries(body).reverse());
    await request(http).post('/orders').set('x-api-key', apiKey).send(reordered).expect(201);
    await request(http)
      .post('/orders')
      .set('x-api-key', apiKey)
      .send({ ...body, amount: 1 })
      .expect(422);
  });

  it('records a balanced sale and rejects bad ones', async () => {
    const res = await request(http)
      .post(`/orders/${orderId}/transactions`)
      .set('x-api-key', apiKey)
      .send(sale)
      .expect(201);
    saleId = res.body.transaction.id;
    // Debits are listed before credits.
    expect(res.body.transaction.entries.map((e: { direction: string }) => e.direction)).toEqual([
      'DEBIT',
      'CREDIT',
      'CREDIT',
    ]);

    const dup = await request(http)
      .post(`/orders/${orderId}/transactions`)
      .set('x-api-key', apiKey)
      .send(sale)
      .expect(201);
    expect(dup.body).toMatchObject({ duplicate: true, transaction: { id: saleId } });

    await request(http)
      .post(`/orders/${orderId}/transactions`)
      .set('x-api-key', apiKey)
      .send({ ...sale, description: 'edited' })
      .expect(422);

    await request(http)
      .post(`/orders/${orderId}/transactions`)
      .set('x-api-key', apiKey)
      .send({ ...sale, externalId: `bad-${stamp}`, entries: [sale.entries[0], { ...sale.entries[2], amount: 1 }] })
      .expect(400);
  });

  it('converts a USD transaction into balanced base amounts', async () => {
    const res = await request(http)
      .post(`/orders/${orderId}/transactions`)
      .set('x-api-key', apiKey)
      .send({
        externalId: `usd-${stamp}`,
        // 23:30 UTC on the 16th is 00:30 on the 17th in Lagos.
        occurredAt: '2026-09-16T23:30:00.000Z',
        currency: 'USD',
        exchangeRate: '1550.25',
        rateSource: 'CBN official 2026-09-16',
        entries: [
          { accountCode: 'cash', direction: 'DEBIT', amount: 1234 },
          { accountCode: 'bundle_revenue', direction: 'CREDIT', amount: 1234 },
        ],
      })
      .expect(201);

    expect(res.body.transaction.rateSource).toBe('CBN official 2026-09-16');
    for (const entry of res.body.transaction.entries) {
      expect(entry.amount.currency).toBe('USD');
      expect(entry.baseAmount).toEqual({ amount: '1913009', currency: 'NGN' });
    }
  });

  it('records a payment fee without an order', async () => {
    await request(http)
      .post(`/services/${serviceId}/accounts`)
      .set('Authorization', bearer)
      .send({ code: 'payment_fees', name: 'Payment fees', type: 'EXPENSE' })
      .expect(201);

    const fee = {
      externalId: `fee-${stamp}`,
      occurredAt: '2026-09-16T18:00:00.000Z',
      currency: 'NGN',
      entries: [
        { accountCode: 'payment_fees', direction: 'DEBIT', amount: 5000 },
        { accountCode: 'cash', direction: 'CREDIT', amount: 5000 },
      ],
    };

    const res = await request(http).post('/transactions').set('x-api-key', apiKey).send(fee).expect(201);
    expect(res.body.transaction.orderId).toBeNull();

    const { currency: _omit, ...withoutCurrency } = fee;
    await request(http)
      .post('/transactions')
      .set('x-api-key', apiKey)
      .send({ ...withoutCurrency, externalId: `fee2-${stamp}` })
      .expect(400);

    const list = await request(http).get('/transactions').set('x-api-key', apiKey).expect(200);
    expect(list.body.transactions.some((t: { id: string }) => t.id === res.body.transaction.id)).toBe(true);
  });

  it('reverses a transaction exactly once', async () => {
    const res = await request(http)
      .post(`/transactions/${saleId}/reverse`)
      .set('x-api-key', apiKey)
      .send({ externalId: `rev-${stamp}`, occurredAt: '2026-09-17T10:00:00.000Z' })
      .expect(201);
    expect(res.body.transaction.reversesTransactionId).toBe(saleId);

    await request(http)
      .post(`/transactions/${saleId}/reverse`)
      .set('x-api-key', apiKey)
      .send({ externalId: `rev2-${stamp}` })
      .expect(409);

    const original = await request(http)
      .get(`/transactions/${saleId}`)
      .set('x-api-key', apiKey)
      .expect(200);
    expect(original.body.reversedByTransactionId).toBe(res.body.transaction.id);
  });

  it('summarises what the order has recognised', async () => {
    const res = await request(http)
      .get(`/orders/${orderId}/summary`)
      .set('x-api-key', apiKey)
      .expect(200);

    // Sale reversed; only the USD top-up's income remains.
    expect(res.body.transactionCount).toBe(3);
    expect(res.body.reversedCount).toBe(1);
    expect(res.body.income.base).toEqual({ amount: '1913009', currency: 'NGN' });
    expect(res.body.income.byCurrency).toEqual(
      expect.arrayContaining([
        { amount: '0', currency: 'NGN' },
        { amount: '1234', currency: 'USD' },
      ]),
    );
    expect(res.body.outstanding).toEqual({ amount: '350000', currency: 'NGN' });
    expect(res.body.fullyRecognised).toBe(false);
  });

  it('produces a balanced trial balance', async () => {
    const res = await request(http)
      .get(`/services/${serviceId}/balances`)
      .set('Authorization', bearer)
      .expect(200);

    const balance = (code: string) =>
      res.body.accounts.find((a: { accountCode: string }) => a.accountCode === code).balance.amount;

    expect(res.body.totals.debit).toEqual(res.body.totals.credit);
    expect(balance('cash')).toBe('1908009');
    expect(balance('payment_fees')).toBe('5000');
    expect(balance('vat_payable')).toBe('0');
    expect(balance('bundle_revenue')).toBe('1913009');
  });

  it('reports net revenue per local day in the service timezone', async () => {
    const res = await request(http)
      .get(`/services/${serviceId}/reports/revenue`)
      .query({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T23:59:59.999Z' })
      .set('Authorization', bearer)
      .expect(200);

    const byDay = Object.fromEntries(
      res.body.series.map((s: { day: string; amount: { amount: string } }) => [s.day, s.amount.amount]),
    );
    // The USD top-up (23:30 UTC on the 16th) lands on the 17th, alongside the reversal.
    expect(res.body.timezone).toBe('Africa/Lagos');
    expect(byDay).toEqual({
      '2026-09-15': '325581',
      '2026-09-17': '1587428',
    });
    expect(res.body.total).toEqual({ amount: '1913009', currency: 'NGN' });
  });
});
