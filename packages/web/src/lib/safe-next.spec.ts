import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    '/services',
    '/services/svc_1/orders?page=2',
    '/services/svc_1/orders#top',
  ])('keeps the path %s', (next) => {
    expect(safeNext(next)).toBe(next);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a repeated parameter', ['/a', '/b']],
    ['an absolute URL', 'https://evil.com'],
    ['a protocol-relative URL', '//evil.com'],
    ['a backslash after the slash', '/\\evil.com'],
    ['a tab that browsers strip', '/\t/evil.com'],
    ['a newline that browsers strip', '/\n/evil.com'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'services'],
    ['the sign-in page, which would loop', '/sign-in'],
    ['the sign-in page with a query', '/sign-in?next=/services'],
  ])('falls back to /services for %s', (_label, next) => {
    expect(safeNext(next)).toBe('/services');
  });
});
