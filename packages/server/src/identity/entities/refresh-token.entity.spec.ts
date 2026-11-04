import { describe, expect, it } from 'vitest';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  RefreshTokenEntity,
} from './refresh-token.entity.js';

const NOW = new Date('2026-11-04T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('RefreshTokenEntity', () => {
  const build = (
    overrides: {
      expiresAt?: Date;
      rotatedAt?: Date | null;
      revokedAt?: Date | null;
    } = {},
  ) =>
    RefreshTokenEntity.fromRecord({
      id: 'rt_1',
      tokenHash: 'hash',
      familyId: 'family_1',
      userId: 'usr_1',
      createdAt: ago(1000),
      expiresAt: overrides.expiresAt ?? new Date(NOW.getTime() + 1000),
      rotatedAt: overrides.rotatedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
    });

  describe('generate', () => {
    it('returns the hash of the token, not the token', () => {
      const { plainToken, tokenHash } = RefreshTokenEntity.generate(NOW);

      expect(tokenHash).toBe(RefreshTokenEntity.hash(plainToken));
      expect(tokenHash).not.toContain(plainToken);
    });

    it('creates a different token each time', () => {
      expect(RefreshTokenEntity.generate(NOW).plainToken).not.toBe(
        RefreshTokenEntity.generate(NOW).plainToken,
      );
    });

    it('expires after the refresh lifetime', () => {
      expect(RefreshTokenEntity.generate(NOW).expiresAt.getTime()).toBe(
        NOW.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000,
      );
    });
  });

  describe('isUsable', () => {
    it('accepts a current token', () => {
      expect(build().isUsable(NOW)).toBe(true);
    });

    it('rejects a token expiring right now', () => {
      expect(build({ expiresAt: NOW }).isUsable(NOW)).toBe(false);
    });

    it('rejects a revoked token', () => {
      expect(build({ revokedAt: ago(1) }).isUsable(NOW)).toBe(false);
    });

    it('still counts a rotated token as usable, leaving that to isReplay', () => {
      expect(build({ rotatedAt: ago(1) }).isUsable(NOW)).toBe(true);
    });
  });

  describe('isReplay', () => {
    it('is false for a token that has not been rotated', () => {
      expect(build().isReplay(NOW)).toBe(false);
    });

    it('allows a repeat up to the end of the grace window', () => {
      expect(build({ rotatedAt: ago(10_000) }).isReplay(NOW)).toBe(false);
    });

    it('flags a repeat after the grace window', () => {
      expect(build({ rotatedAt: ago(10_001) }).isReplay(NOW)).toBe(true);
    });
  });
});
