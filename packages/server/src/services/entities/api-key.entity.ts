import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ApiKey } from '../../generated/prisma/client.js';

const KEY_PATTERN = /^sk_live_([0-9a-f]{16})_(.+)$/;
const USAGE_STALE_MS = 300_000;

export class ApiKeyEntity {
  private constructor(
    readonly id: string,
    readonly publicId: string,
    readonly name: string,
    readonly serviceId: string,
    readonly createdAt: Date,
    readonly lastUsedAt: Date | null,
    readonly revokedAt: Date | null,
    private readonly secretHash: string,
  ) {}

  static fromRecord(row: ApiKey): ApiKeyEntity {
    return new ApiKeyEntity(
      row.id,
      row.publicId,
      row.name,
      row.serviceId,
      row.createdAt,
      row.lastUsedAt,
      row.revokedAt,
      row.secretHash,
    );
  }

  /** Mints a new key. `plainKey` is shown to the caller once and never stored. */
  static generate() {
    const publicId = randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('hex');

    return {
      publicId,
      secretHash: ApiKeyEntity.hashSecret(secret),
      plainKey: `sk_live_${publicId}_${secret}`,
    };
  }

  /** Splits a presented `sk_live_<publicId>_<secret>` key, or null if malformed. */
  static parse(presented: string): { publicId: string; secret: string } | null {
    const match = KEY_PATTERN.exec(presented);
    return match ? { publicId: match[1], secret: match[2] } : null;
  }

  static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  get isActive(): boolean {
    return this.revokedAt === null;
  }

  get prefix(): string {
    return `sk_live_${this.publicId}`;
  }

  matchesSecret(secret: string): boolean {
    const presented = createHash('sha256').update(secret).digest();
    const stored = Buffer.from(this.secretHash, 'hex');

    return (
      presented.length === stored.length && timingSafeEqual(presented, stored)
    );
  }

  isUsageStale(now: Date): boolean {
    return (
      !this.lastUsedAt ||
      now.getTime() - this.lastUsedAt.getTime() > USAGE_STALE_MS
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      prefix: this.prefix,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      revokedAt: this.revokedAt,
      active: this.isActive,
    };
  }
}
