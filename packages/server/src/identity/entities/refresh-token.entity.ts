import { createHash, randomBytes } from 'node:crypto';
import type { RefreshToken } from '../../generated/prisma/client.js';

export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * How long a spent token may be presented again. A page loading several
 * requests at once sends the same token more than once, which isn't theft.
 */
const REUSE_GRACE_MS = 10_000;

export class RefreshTokenEntity {
  private constructor(
    readonly id: string,
    readonly familyId: string,
    readonly userId: string,
    readonly expiresAt: Date,
    readonly rotatedAt: Date | null,
    readonly revokedAt: Date | null,
  ) {}

  static fromRecord(row: RefreshToken): RefreshTokenEntity {
    return new RefreshTokenEntity(
      row.id,
      row.familyId,
      row.userId,
      row.expiresAt,
      row.rotatedAt,
      row.revokedAt,
    );
  }

  /** Mints a new token. `plainToken` goes to the caller and is never stored. */
  static generate(now: Date) {
    const plainToken = randomBytes(32).toString('base64url');

    return {
      plainToken,
      tokenHash: RefreshTokenEntity.hash(plainToken),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    };
  }

  /** SHA-256 is enough here because the token is high-entropy and random. */
  static hash(plainToken: string): string {
    return createHash('sha256').update(plainToken).digest('hex');
  }

  isUsable(now: Date): boolean {
    return this.revokedAt === null && this.expiresAt > now;
  }

  /** Spent too long ago to be a race, so two parties must hold this token. */
  isReplay(now: Date): boolean {
    return (
      this.rotatedAt !== null &&
      now.getTime() - this.rotatedAt.getTime() > REUSE_GRACE_MS
    );
  }
}
