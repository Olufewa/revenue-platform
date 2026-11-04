import type { Order } from '../../generated/prisma/client.js';
import { Money } from '../../money/money.js';

/** Something a customer bought from a service; the ledger records its money. */
export class OrderEntity {
  private constructor(
    readonly id: string,
    readonly serviceId: string,
    readonly externalId: string,
    readonly total: Money,
    readonly description: string | null,
    readonly customerRef: string | null,
    readonly metadata: unknown,
    readonly requestHash: string | null,
    readonly placedAt: Date,
    readonly createdAt: Date,
  ) {}

  static fromRecord(row: Order): OrderEntity {
    return new OrderEntity(
      row.id,
      row.serviceId,
      row.externalId,
      Money.of(row.amountMinor, row.currency),
      row.description,
      row.customerRef,
      row.metadata,
      row.requestHash,
      row.placedAt,
      row.createdAt,
    );
  }

  toJSON() {
    return {
      id: this.id,
      externalId: this.externalId,
      total: this.total,
      description: this.description,
      customerRef: this.customerRef,
      metadata: this.metadata ?? null,
      placedAt: this.placedAt,
      createdAt: this.createdAt,
    };
  }
}
