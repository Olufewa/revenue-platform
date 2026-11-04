import { describe, expect, it } from 'vitest';
import { ApiKeyEntity } from './api-key.entity.js';

describe('ApiKeyEntity', () => {
  const build = (
    overrides: { revokedAt?: Date | null; lastUsedAt?: Date | null } = {},
  ) => {
    const generated = ApiKeyEntity.generate();
    const key = ApiKeyEntity.fromRecord({
      id: 'key_1',
      publicId: generated.publicId,
      secretHash: generated.secretHash,
      name: 'Ingest key',
      serviceId: 'svc_1',
      createdAt: new Date(),
      lastUsedAt: overrides.lastUsedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
    });
    return { key, plainKey: generated.plainKey };
  };

  it('generates keys in the sk_live_<publicId>_<secret> format', () => {
    expect(ApiKeyEntity.generate().plainKey).toMatch(
      /^sk_live_[a-f0-9]{16}_[a-f0-9]{64}$/,
    );
  });

  it('parses its own keys and rejects malformed ones', () => {
    const { key, plainKey } = build();

    expect(ApiKeyEntity.parse(plainKey)?.publicId).toBe(key.publicId);
    expect(ApiKeyEntity.parse('garbage')).toBeNull();
    expect(ApiKeyEntity.parse('sk_live_XYZ_secret')).toBeNull();
  });

  it('matches only the original secret', () => {
    const { key, plainKey } = build();
    const { secret } = ApiKeyEntity.parse(plainKey)!;

    expect(key.matchesSecret(secret)).toBe(true);
    expect(
      key.matchesSecret(secret.replace(/.$/, (c) => (c === '0' ? '1' : '0'))),
    ).toBe(false);
  });

  it('is inactive once revoked', () => {
    expect(build().key.isActive).toBe(true);
    expect(build({ revokedAt: new Date() }).key.isActive).toBe(false);
  });

  it('treats usage as stale after five minutes or when never used', () => {
    const now = new Date('2026-09-29T12:00:00.000Z');

    expect(build().key.isUsageStale(now)).toBe(true);
    expect(
      build({
        lastUsedAt: new Date('2026-09-29T11:58:00.000Z'),
      }).key.isUsageStale(now),
    ).toBe(false);
    expect(
      build({
        lastUsedAt: new Date('2026-09-29T11:54:00.000Z'),
      }).key.isUsageStale(now),
    ).toBe(true);
  });

  it('serialises metadata without the secret hash', () => {
    const { key } = build();
    const json = JSON.parse(JSON.stringify(key));

    expect(json.secretHash).toBeUndefined();
    expect(json.key).toBeUndefined();
    expect(json.prefix).toBe(`sk_live_${key.publicId}`);
    expect(json.active).toBe(true);
  });
});
