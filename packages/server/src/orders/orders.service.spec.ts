import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { requestHash } from '../common/request-hash.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServicesService } from '../services/services.service.js';
import { orderFixture } from '../test/fixtures.js';
import type { NewOrder, OrderRepository } from './order.repository.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  const orders = { findByExternalId: vi.fn(), findInService: vi.fn(), create: vi.fn() };
  const services = { assertCanAccess: vi.fn() };
  let sut: OrdersService;

  const dto = {
    externalId: 'bundle-3500-1',
    amount: 350000,
    currency: 'NGN',
    placedAt: '2026-09-15T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    sut = new OrdersService(
      orders as unknown as OrderRepository,
      services as unknown as ServicesService,
    );
  });

  it('creates an order with its total as Money', async () => {
    orders.findByExternalId.mockResolvedValue(null);
    orders.create.mockResolvedValue(orderFixture());

    const result = await sut.create('svc_1', dto);
    const created: NewOrder = orders.create.mock.calls[0][0];

    expect(result.duplicate).toBe(false);
    expect(created.total.toString()).toBe('350000 NGN');
    expect(created.placedAt).toEqual(new Date(dto.placedAt));
  });

  it('returns the original order on a repeated externalId', async () => {
    const existing = orderFixture();
    orders.findByExternalId.mockResolvedValue(existing);

    await expect(sut.create('svc_1', dto)).resolves.toEqual({ duplicate: true, order: existing });
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('stores a hash of the request', async () => {
    orders.findByExternalId.mockResolvedValue(null);
    orders.create.mockResolvedValue(orderFixture());

    await sut.create('svc_1', dto);

    expect(orders.create.mock.calls[0][0].requestHash).toBe(requestHash(dto));
  });

  it('accepts an identical retry', async () => {
    const existing = orderFixture({ requestHash: requestHash(dto) });
    orders.findByExternalId.mockResolvedValue(existing);

    await expect(sut.create('svc_1', { ...dto })).resolves.toEqual({
      duplicate: true,
      order: existing,
    });
  });

  it('refuses a reused externalId with a different amount (422)', async () => {
    orders.findByExternalId.mockResolvedValue(orderFixture({ requestHash: requestHash(dto) }));

    await expect(sut.create('svc_1', { ...dto, amount: 1 })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('treats a unique-violation race as a duplicate', async () => {
    const raced = orderFixture();
    orders.findByExternalId.mockResolvedValueOnce(null).mockResolvedValueOnce(raced);
    orders.create.mockRejectedValue({ code: 'P2002' });

    await expect(sut.create('svc_1', dto)).resolves.toEqual({ duplicate: true, order: raced });
  });

  it('throws 404 for an order on another service', async () => {
    orders.findInService.mockResolvedValue(null);

    await expect(sut.findOne('svc_1', 'ord_x')).rejects.toThrow(NotFoundException);
  });
});
