import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { requestHash } from '../common/request-hash.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountRepository } from '../accounts/account.repository.js';
import type { OrdersService } from '../orders/orders.service.js';
import type { ServicesService } from '../services/services.service.js';
import {
  accountFixture,
  orderFixture,
  serviceFixture,
  transactionFixture,
} from '../test/fixtures.js';
import type { CreateTransactionDto } from './dto/create-transaction.dto.js';
import type {
  LedgerTransactionRepository,
  NewLedgerTransaction,
} from './ledger-transaction.repository.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  const transactions = {
    findByExternalId: vi.fn(),
    findInService: vi.fn(),
    listForOrder: vi.fn(),
    create: vi.fn(),
  };
  const accounts = { findByCodes: vi.fn() };
  const orders = { findOne: vi.fn() };
  const services = { assertCanAccess: vi.fn() };

  const service = serviceFixture();
  let sut: TransactionsService;

  const sale: CreateTransactionDto = {
    externalId: 'sale-1',
    occurredAt: '2026-09-15T12:00:00.000Z',
    entries: [
      { accountCode: 'cash', direction: 'DEBIT', amount: 350000 },
      { accountCode: 'vat_payable', direction: 'CREDIT', amount: 24419 },
      { accountCode: 'bundle_revenue', direction: 'CREDIT', amount: 325581 },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    sut = new TransactionsService(
      transactions as unknown as LedgerTransactionRepository,
      accounts as unknown as AccountRepository,
      orders as unknown as OrdersService,
      services as unknown as ServicesService,
    );

    orders.findOne.mockResolvedValue(orderFixture());
    transactions.findByExternalId.mockResolvedValue(null);
    accounts.findByCodes.mockResolvedValue([
      accountFixture('cash', 'ASSET'),
      accountFixture('vat_payable', 'LIABILITY'),
      accountFixture('bundle_revenue', 'INCOME'),
    ]);
    transactions.create.mockImplementation(async () => transactionFixture());
  });

  const created = (): NewLedgerTransaction => transactions.create.mock.calls[0][0];

  describe('record', () => {
    it('writes a balanced transaction in the order currency', async () => {
      const result = await sut.record(service, 'ord_1', sale);

      expect(result.duplicate).toBe(false);
      expect(created().currency.code).toBe('NGN');
      expect(created().exchangeRate.isOne).toBe(true);
      expect(created().entries.map((e) => [e.accountId, e.direction, e.amount.amountMinor])).toEqual([
        ['acc_cash', 'DEBIT', 350000n],
        ['acc_vat_payable', 'CREDIT', 24419n],
        ['acc_bundle_revenue', 'CREDIT', 325581n],
      ]);
    });

    it('converts a foreign-currency transaction into base amounts', async () => {
      await sut.record(service, 'ord_1', {
        ...sale,
        currency: 'USD',
        exchangeRate: '1550.25',
        rateSource: 'CBN official 2026-09-16',
        entries: [
          { accountCode: 'cash', direction: 'DEBIT', amount: 1234 },
          { accountCode: 'bundle_revenue', direction: 'CREDIT', amount: 1234 },
        ],
      });

      expect(created().currency.code).toBe('USD');
      expect(created().rateSource).toBe('CBN official 2026-09-16');
      expect(created().entries.map((e) => e.baseAmount.toString())).toEqual([
        '1913009 NGN',
        '1913009 NGN',
      ]);
    });

    it('returns the original on a repeated externalId', async () => {
      const original = transactionFixture();
      transactions.findByExternalId.mockResolvedValue(original);

      const result = await sut.record(service, 'ord_1', sale);

      expect(result).toEqual({ duplicate: true, transaction: original });
      expect(transactions.create).not.toHaveBeenCalled();
    });

    it('refuses a reused externalId with different entries (422)', async () => {
      transactions.findByExternalId.mockResolvedValue(
        transactionFixture({ requestHash: requestHash({ ...sale, orderId: 'ord_1' }) }),
      );
      const changed = { ...sale, description: 'edited' };

      await expect(sut.record(service, 'ord_1', changed)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('accepts an identical retry', async () => {
      const original = transactionFixture({
        requestHash: requestHash({ ...sale, orderId: 'ord_1' }),
      });
      transactions.findByExternalId.mockResolvedValue(original);

      await expect(sut.record(service, 'ord_1', sale)).resolves.toEqual({
        duplicate: true,
        transaction: original,
      });
    });

    it('refuses an externalId already used on another order', async () => {
      transactions.findByExternalId.mockResolvedValue(transactionFixture({ orderId: 'ord_2' }));

      await expect(sut.record(service, 'ord_1', sale)).rejects.toThrow(ConflictException);
    });

    it('returns 400 for an unbalanced transaction', async () => {
      const unbalanced = {
        ...sale,
        entries: [sale.entries[0], { ...sale.entries[1], amount: 1 }],
      };

      await expect(sut.record(service, 'ord_1', unbalanced)).rejects.toThrow(
        BadRequestException,
      );
      expect(transactions.create).not.toHaveBeenCalled();
    });

    it('returns 400 naming unknown account codes', async () => {
      accounts.findByCodes.mockResolvedValue([accountFixture('cash', 'ASSET')]);

      await expect(sut.record(service, 'ord_1', sale)).rejects.toThrow(
        'Unknown account code(s): vat_payable, bundle_revenue',
      );
    });

    it('records a transaction without an order when a currency is given', async () => {
      await sut.record(service, null, {
        ...sale,
        currency: 'NGN',
        entries: [
          { accountCode: 'cash', direction: 'CREDIT', amount: 5000 },
          { accountCode: 'bundle_revenue', direction: 'DEBIT', amount: 5000 },
        ],
      });

      expect(orders.findOne).not.toHaveBeenCalled();
      expect(created().orderId).toBeNull();
      expect(created().currency.code).toBe('NGN');
    });

    it('requires a currency when there is no order', async () => {
      await expect(sut.record(service, null, sale)).rejects.toThrow(
        'currency is required when the transaction has no order',
      );
    });

    it('propagates 404 for an unknown order', async () => {
      orders.findOne.mockRejectedValue(new NotFoundException());

      await expect(sut.record(service, 'ord_x', sale)).rejects.toThrow(NotFoundException);
    });

    it('treats a unique-violation race as a duplicate', async () => {
      const raced = transactionFixture();
      transactions.findByExternalId.mockResolvedValueOnce(null).mockResolvedValueOnce(raced);
      transactions.create.mockRejectedValue({ code: 'P2002' });

      await expect(sut.record(service, 'ord_1', sale)).resolves.toEqual({
        duplicate: true,
        transaction: raced,
      });
    });
  });

  describe('summary', () => {
    it('reports income recognised against the order and what is outstanding', async () => {
      transactions.listForOrder.mockResolvedValue([
        // ₦3,500 sale (₦3,255.81 income), then half of it refunded.
        transactionFixture(),
        transactionFixture({
          id: 'txn_2',
          entries: [
            { code: 'bundle_revenue', direction: 'DEBIT', amount: 162790n },
            { code: 'vat_payable', direction: 'DEBIT', amount: 12210n },
            { code: 'cash', direction: 'CREDIT', amount: 175000n },
          ],
        }),
      ]);

      const result = JSON.parse(JSON.stringify(await sut.summary(service, 'ord_1')));

      expect(result.transactionCount).toBe(2);
      expect(result.income.base).toEqual({ amount: '162791', currency: 'NGN' });
      expect(result.income.byCurrency).toEqual([{ amount: '162791', currency: 'NGN' }]);
      expect(result.outstanding).toEqual({ amount: '187209', currency: 'NGN' });
      expect(result.fullyRecognised).toBe(false);
    });

    it('is fully recognised when income equals the order total', async () => {
      transactions.listForOrder.mockResolvedValue([
        transactionFixture({
          entries: [
            { code: 'cash', direction: 'DEBIT', amount: 350000n },
            { code: 'bundle_revenue', direction: 'CREDIT', amount: 350000n },
          ],
        }),
      ]);

      const result = await sut.summary(service, 'ord_1');

      expect(result.fullyRecognised).toBe(true);
      expect(result.outstanding.isZero()).toBe(true);
    });

    it('reports zero income in base currency for an order with no transactions', async () => {
      transactions.listForOrder.mockResolvedValue([]);

      const result = await sut.summary(service, 'ord_1');

      expect(result.income.base.toString()).toBe('0 NGN');
      expect(result.transactionCount).toBe(0);
    });
  });

  describe('reverse', () => {
    const dto = { externalId: 'sale-1-reversal', occurredAt: '2026-09-16T09:00:00.000Z' };

    it('writes mirror-image entries linked to the original', async () => {
      transactions.findInService.mockResolvedValue(
        transactionFixture({ rateSource: 'CBN official 2026-09-15' }),
      );

      await sut.reverse(service, 'txn_1', dto);

      expect(created().rateSource).toBe('CBN official 2026-09-15');
      expect(created().reversesTransactionId).toBe('txn_1');
      expect(created().orderId).toBe('ord_1');
      expect(created().entries.map((e) => [e.accountId, e.direction, e.baseAmount.amountMinor])).toEqual([
        ['acc_cash', 'CREDIT', 350000n],
        ['acc_vat_payable', 'DEBIT', 24419n],
        ['acc_bundle_revenue', 'DEBIT', 325581n],
      ]);
    });

    it('refuses to reverse twice', async () => {
      transactions.findInService.mockResolvedValue(transactionFixture({ reversedById: 'txn_2' }));

      await expect(sut.reverse(service, 'txn_1', dto)).rejects.toThrow(
        'This transaction has already been reversed',
      );
    });

    it('refuses to reverse a reversal', async () => {
      transactions.findInService.mockResolvedValue(
        transactionFixture({ reversesTransactionId: 'txn_0' }),
      );

      await expect(sut.reverse(service, 'txn_1', dto)).rejects.toThrow(
        'A reversal cannot itself be reversed',
      );
    });

    it('is idempotent on the reversal externalId', async () => {
      const reversal = transactionFixture({ id: 'txn_2', reversesTransactionId: 'txn_1' });
      transactions.findInService.mockResolvedValue(transactionFixture({ reversedById: 'txn_2' }));
      transactions.findByExternalId.mockResolvedValue(reversal);

      await expect(sut.reverse(service, 'txn_1', dto)).resolves.toEqual({
        duplicate: true,
        transaction: reversal,
      });
    });

    it('refuses a reused reversal externalId with a different body (422)', async () => {
      transactions.findInService.mockResolvedValue(transactionFixture({ reversedById: 'txn_2' }));
      transactions.findByExternalId.mockResolvedValue(
        transactionFixture({
          id: 'txn_2',
          reversesTransactionId: 'txn_1',
          requestHash: requestHash({ ...dto, reverses: 'txn_1' }),
        }),
      );

      await expect(
        sut.reverse(service, 'txn_1', { ...dto, description: 'different' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('returns 404 for an unknown transaction', async () => {
      transactions.findInService.mockResolvedValue(null);

      await expect(sut.reverse(service, 'txn_x', dto)).rejects.toThrow(NotFoundException);
    });
  });
});
