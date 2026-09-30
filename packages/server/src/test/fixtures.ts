import { AccountEntity } from '../accounts/entities/account.entity.js';
import type { AccountType } from '../generated/prisma/client.js';
import {
  LedgerTransactionEntity,
  type LedgerTransactionRecord,
} from '../ledger/entities/ledger-transaction.entity.js';
import { OrderEntity } from '../orders/entities/order.entity.js';
import { ServiceEntity } from '../services/entities/service.entity.js';

export function serviceFixture(overrides: { id?: string; baseCurrency?: string } = {}) {
  return ServiceEntity.fromRecord({
    id: overrides.id ?? 'svc_1',
    slug: 'airtime-1a2b3c4d',
    name: 'MTN Airtime Service',
    baseCurrency: overrides.baseCurrency ?? 'NGN',
    timezone: 'Africa/Lagos',
    ownerId: 'usr_1',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

export function accountFixture(code: string, type: AccountType) {
  return AccountEntity.fromRecord({
    id: `acc_${code}`,
    serviceId: 'svc_1',
    code,
    name: code.replace(/_/g, ' '),
    type,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    archivedAt: null,
  });
}

export function orderFixture(
  overrides: { id?: string; amount?: bigint; currency?: string; requestHash?: string | null } = {},
) {
  return OrderEntity.fromRecord({
    id: overrides.id ?? 'ord_1',
    serviceId: 'svc_1',
    externalId: 'bundle-3500-1',
    amountMinor: overrides.amount ?? 350000n,
    currency: overrides.currency ?? 'NGN',
    description: '1GB data bundle',
    customerRef: '+2348030001234',
    metadata: null,
    requestHash: overrides.requestHash ?? null,
    placedAt: new Date('2026-09-15T12:00:00.000Z'),
    createdAt: new Date('2026-09-15T12:00:01.000Z'),
  });
}

type EntrySpec = { code: string; direction: 'DEBIT' | 'CREDIT'; amount: bigint; base?: bigint };

export function transactionFixture(
  overrides: Partial<Omit<LedgerTransactionRecord, 'entries' | 'service' | 'reversedBy'>> & {
    entries?: EntrySpec[];
    reversedById?: string;
    baseCurrency?: string;
  } = {},
) {
  const { entries, reversedById, baseCurrency, ...fields } = overrides;
  const occurredAt = fields.occurredAt ?? new Date('2026-09-15T12:00:00.000Z');

  const specs: EntrySpec[] = entries ?? [
    { code: 'cash', direction: 'DEBIT', amount: 350000n },
    { code: 'vat_payable', direction: 'CREDIT', amount: 24419n },
    { code: 'bundle_revenue', direction: 'CREDIT', amount: 325581n },
  ];

  return LedgerTransactionEntity.fromRecord({
    id: 'txn_1',
    serviceId: 'svc_1',
    orderId: 'ord_1',
    externalId: 'sale-1',
    description: null,
    currency: 'NGN',
    exchangeRate: '1',
    rateSource: null,
    requestHash: null,
    occurredAt,
    createdAt: occurredAt,
    reversesTransactionId: null,
    ...fields,
    service: { baseCurrency: baseCurrency ?? 'NGN' },
    reversedBy: reversedById ? { id: reversedById } : null,
    entries: specs.map((e, i) => ({
      id: `ent_${i}`,
      transactionId: fields.id ?? 'txn_1',
      serviceId: 'svc_1',
      accountId: `acc_${e.code}`,
      direction: e.direction,
      amountMinor: e.amount,
      baseAmountMinor: e.base ?? e.amount,
      occurredAt,
      account: { code: e.code, name: e.code, type: accountTypeFor(e.code) },
    })),
  });
}

function accountTypeFor(code: string): AccountType {
  if (code.endsWith('_revenue')) return 'INCOME';
  if (code.endsWith('_payable')) return 'LIABILITY';
  if (code.endsWith('_fees')) return 'EXPENSE';
  return 'ASSET';
}
