import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountRepository } from '../accounts/account.repository.js';
import { Currency } from '../money/currency.js';
import { ExchangeRate } from '../money/exchange-rate.js';
import { Money } from '../money/money.js';
import { OrdersService } from '../orders/orders.service.js';
import { isUniqueViolation } from '../prisma/db-client.js';
import type { ServiceEntity } from '../services/entities/service.entity.js';
import { ServicesService } from '../services/services.service.js';
import {
  buildTransaction,
  InvalidTransactionError,
  type DraftTransaction,
} from './accounting-transaction.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto.js';
import type { LedgerTransactionEntity } from './entities/ledger-transaction.entity.js';
import { LedgerTransactionRepository } from './ledger-transaction.repository.js';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly accounts: AccountRepository,
    private readonly orders: OrdersService,
    private readonly services: ServicesService,
  ) {}

  /**
   * Records a balanced transaction against an order. Resending the same
   * externalId for the same order returns the original.
   */
  async record(service: ServiceEntity, orderId: string, dto: CreateTransactionDto) {
    const order = await this.orders.findOne(service.id, orderId);

    const existing = await this.findExistingFor(service.id, dto.externalId, orderId);
    if (existing) {
      return { duplicate: true, transaction: existing };
    }

    const currency = dto.currency ? Currency.of(dto.currency) : order.total.currency;
    const draft = this.build(() =>
      buildTransaction({
        currency,
        baseCurrency: service.baseCurrency,
        exchangeRate: dto.exchangeRate ? ExchangeRate.parse(dto.exchangeRate) : undefined,
        legs: dto.entries.map((leg) => ({
          accountCode: leg.accountCode,
          direction: leg.direction,
          amount: Money.of(leg.amount, currency),
        })),
      }),
    );

    const accountIds = await this.resolveAccounts(service.id, draft);

    try {
      const transaction = await this.transactions.create({
        serviceId: service.id,
        orderId: order.id,
        externalId: dto.externalId,
        description: dto.description,
        currency: draft.currency,
        exchangeRate: draft.exchangeRate,
        occurredAt: new Date(dto.occurredAt),
        entries: draft.entries.map((entry) => ({
          ...entry,
          accountId: accountIds.get(entry.accountCode)!,
        })),
      });

      return { duplicate: false, transaction };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const raced = await this.findExistingFor(service.id, dto.externalId, orderId);
      return { duplicate: true, transaction: raced! };
    }
  }

  /** Cancels a transaction with its mirror image. Each can be reversed once. */
  async reverse(service: ServiceEntity, transactionId: string, dto: ReverseTransactionDto) {
    const original = await this.findOne(service.id, transactionId);

    const existing = await this.transactions.findByExternalId(service.id, dto.externalId);
    if (existing) {
      if (existing.reversesTransactionId !== original.id) {
        throw new ConflictException(
          `externalId "${dto.externalId}" is already used by another transaction`,
        );
      }
      return { duplicate: true, transaction: existing };
    }

    if (original.isReversal) {
      throw new ConflictException('A reversal cannot itself be reversed');
    }

    if (original.isReversed) {
      throw new ConflictException('This transaction has already been reversed');
    }

    try {
      const transaction = await this.transactions.create({
        serviceId: service.id,
        orderId: original.orderId,
        externalId: dto.externalId,
        description: dto.description ?? `Reversal of ${original.externalId}`,
        currency: original.currency,
        exchangeRate: original.exchangeRate,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        reversesTransactionId: original.id,
        entries: original.reversalEntries(),
      });

      return { duplicate: false, transaction };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      throw new ConflictException('This transaction has already been reversed');
    }
  }

  async findOne(serviceId: string, id: string) {
    const transaction = await this.transactions.findInService(serviceId, id);

    if (!transaction) {
      throw new NotFoundException('No such transaction on this service');
    }

    return transaction;
  }

  async listForOrder(serviceId: string, orderId: string) {
    await this.orders.findOne(serviceId, orderId);
    return this.transactions.listForOrder(serviceId, orderId);
  }

  async findOneForUser(serviceId: string, userId: string, id: string) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.findOne(serviceId, id);
  }

  async listForOrderForUser(serviceId: string, userId: string, orderId: string) {
    await this.services.assertCanAccess(serviceId, userId);
    return this.listForOrder(serviceId, orderId);
  }

  private async findExistingFor(
    serviceId: string,
    externalId: string,
    orderId: string,
  ): Promise<LedgerTransactionEntity | null> {
    const existing = await this.transactions.findByExternalId(serviceId, externalId);

    if (existing && existing.orderId !== orderId) {
      throw new ConflictException(
        `externalId "${externalId}" is already used by a transaction on another order`,
      );
    }

    return existing;
  }

  private build(fn: () => DraftTransaction): DraftTransaction {
    try {
      return fn();
    } catch (error) {
      if (error instanceof InvalidTransactionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async resolveAccounts(serviceId: string, draft: DraftTransaction) {
    const codes = [...new Set(draft.entries.map((e) => e.accountCode))];
    const accounts = await this.accounts.findByCodes(serviceId, codes);
    const ids = new Map(accounts.map((a) => [a.code, a.id]));

    const missing = codes.filter((code) => !ids.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown account code(s): ${missing.join(', ')}`);
    }

    return ids;
  }
}
