import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServicesService } from '../services/services.service.js';
import { accountFixture } from '../test/fixtures.js';
import type { AccountRepository } from './account.repository.js';
import { AccountsService } from './accounts.service.js';

describe('AccountsService', () => {
  const accounts = {
    create: vi.fn(),
    findByCode: vi.fn(),
    update: vi.fn(),
    listForService: vi.fn(),
  };
  const services = { assertCanAccess: vi.fn() };
  let sut: AccountsService;

  beforeEach(() => {
    vi.resetAllMocks();
    sut = new AccountsService(
      accounts as unknown as AccountRepository,
      services as unknown as ServicesService,
    );
    accounts.findByCode.mockResolvedValue(
      accountFixture('promo_revenue', 'INCOME'),
    );
    accounts.update.mockImplementation(async () =>
      accountFixture('promo_revenue', 'INCOME'),
    );
  });

  it('turns a duplicate code into 409', async () => {
    accounts.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      sut.create('svc_1', 'usr_1', {
        code: 'cash',
        name: 'Cash',
        type: 'ASSET',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('archives an account', async () => {
    await sut.update('svc_1', 'usr_1', 'promo_revenue', { archived: true });

    expect(accounts.update).toHaveBeenCalledWith('acc_promo_revenue', {
      name: undefined,
      archivedAt: expect.any(Date),
    });
  });

  it('keeps the original archive date when archiving again', async () => {
    const archivedAt = new Date('2026-09-01T00:00:00.000Z');
    accounts.findByCode.mockResolvedValue(
      accountFixture('promo_revenue', 'INCOME', archivedAt),
    );

    await sut.update('svc_1', 'usr_1', 'promo_revenue', { archived: true });

    expect(accounts.update.mock.calls[0][1].archivedAt).toBe(archivedAt);
  });

  it('unarchives and renames', async () => {
    await sut.update('svc_1', 'usr_1', 'promo_revenue', {
      archived: false,
      name: 'Promotions',
    });

    expect(accounts.update).toHaveBeenCalledWith('acc_promo_revenue', {
      name: 'Promotions',
      archivedAt: null,
    });
  });

  it('does nothing for an empty patch', async () => {
    const result = await sut.update('svc_1', 'usr_1', 'promo_revenue', {});

    expect(accounts.update).not.toHaveBeenCalled();
    expect(result.code).toBe('promo_revenue');
  });

  it('returns 404 for an unknown code', async () => {
    accounts.findByCode.mockResolvedValue(null);

    await expect(
      sut.update('svc_1', 'usr_1', 'nope', { archived: true }),
    ).rejects.toThrow(NotFoundException);
  });
});
