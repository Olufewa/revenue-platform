import { describe, expect, it } from 'vitest';
import { readClaims } from './jwt';
import { readSession } from './session-cookie';
import { secondsFromNow, testToken } from './test-token';

describe('readClaims', () => {
  it('reads the email and expiry', () => {
    const token = testToken({ sub: 'usr_1', email: 'ada@mtn.test', exp: 123 });
    expect(readClaims(token)).toEqual({ email: 'ada@mtn.test', exp: 123 });
  });

  it('decodes non-ASCII emails', () => {
    const token = testToken({ email: 'adé@mtn.test', exp: 123 });
    expect(readClaims(token)?.email).toBe('adé@mtn.test');
  });

  it.each([
    ['no payload', 'not-a-token'],
    ['a payload that is not base64', 'a.%%%.c'],
    ['a payload that is not JSON', `a.${btoa('nope')}.c`],
    ['a missing exp', testToken({ email: 'ada@mtn.test' })],
    ['a missing email', testToken({ exp: 123 })],
  ])('returns null for %s', (_label, token) => {
    expect(readClaims(token)).toBeNull();
  });
});

describe('readSession', () => {
  const session = (exp: number) => testToken({ email: 'ada@mtn.test', exp });

  it('accepts an unexpired token', () => {
    expect(readSession(session(secondsFromNow(60)))?.email).toBe(
      'ada@mtn.test',
    );
  });

  it('rejects expired, missing and malformed tokens', () => {
    expect(readSession(session(secondsFromNow(-60)))).toBeNull();
    expect(readSession(undefined)).toBeNull();
    expect(readSession('garbage')).toBeNull();
  });
});
