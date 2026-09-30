import { randomUUID } from 'node:crypto';
import type { Service } from '../../generated/prisma/client.js';
import { Currency } from '../../money/currency.js';

export class ServiceEntity {
  private constructor(
    readonly id: string,
    readonly slug: string,
    readonly name: string,
    readonly baseCurrency: Currency,
    readonly ownerId: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static fromRecord(row: Service): ServiceEntity {
    return new ServiceEntity(
      row.id,
      row.slug,
      row.name,
      Currency.of(row.baseCurrency),
      row.ownerId,
      row.createdAt,
      row.updatedAt,
    );
  }

  /** A URL-safe slug from the name plus a short random suffix. */
  static generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .normalize('NFD') // Separate accented characters into base letters and diacritics
      .replace(/[̀-ͯ]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric chars (except spaces & hyphens)
      .replace(/[\s_]+/g, '-') // Convert spaces/underscores to hyphens
      .replace(/-+/g, '-') // Remove consecutive hyphens
      .slice(0, 25);
    const suffix = randomUUID().split('-')[0];

    return base ? `${base}-${suffix}` : suffix;
  }

  isOwnedBy(userId: string): boolean {
    return this.ownerId === userId;
  }

  toJSON() {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      baseCurrency: this.baseCurrency.code,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
