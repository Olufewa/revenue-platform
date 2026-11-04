import { UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';

/** A stable fingerprint of a request body: key order does not matter. */
export function requestHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * An idempotent retry must repeat the original request exactly. Reusing an
 * externalId for different content is a client bug, so it is refused rather
 * than silently answered with the original. Rows stored before hashes
 * existed (`null`) are not compared.
 */
export function assertSameRequest(
  storedHash: string | null,
  hash: string,
  externalId: string,
): void {
  if (storedHash !== null && storedHash !== hash) {
    throw new UnprocessableEntityException(
      `externalId "${externalId}" was already used with a different request`,
    );
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}
