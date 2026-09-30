import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertSameRequest, requestHash } from './request-hash.js';

describe('requestHash', () => {
  it('ignores key order, including nested objects', () => {
    expect(requestHash({ a: 1, b: { x: 1, y: [1, { p: 1, q: 2 }] } })).toBe(
      requestHash({ b: { y: [1, { q: 2, p: 1 }], x: 1 }, a: 1 }),
    );
  });

  it('ignores undefined fields but not nulls', () => {
    expect(requestHash({ a: 1, b: undefined })).toBe(requestHash({ a: 1 }));
    expect(requestHash({ a: 1, b: null })).not.toBe(requestHash({ a: 1 }));
  });

  it('is sensitive to array order and values', () => {
    expect(requestHash([1, 2])).not.toBe(requestHash([2, 1]));
    expect(requestHash({ amount: 350000 })).not.toBe(requestHash({ amount: 350001 }));
  });
});

describe('assertSameRequest', () => {
  it('accepts a matching hash and legacy rows without one', () => {
    expect(() => assertSameRequest('abc', 'abc', 'x')).not.toThrow();
    expect(() => assertSameRequest(null, 'abc', 'x')).not.toThrow();
  });

  it('refuses a reused externalId with a different body', () => {
    expect(() => assertSameRequest('abc', 'def', 'order-1')).toThrow(UnprocessableEntityException);
  });
});
