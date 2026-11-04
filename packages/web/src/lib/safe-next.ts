const FALLBACK = '/services';
const BASE = 'http://same-site.invalid';

/**
 * Where to go after signing in. Only paths on this site are accepted, so a
 * crafted `?next=` link can't send someone to another site.
 */
export function safeNext(next: string | string[] | null | undefined): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return FALLBACK;

  // Browsers treat `\` as `/` and strip tabs and newlines from URLs, which
  // would turn these into `//other-site`.
  // oxlint-disable-next-line no-control-regex
  if (next.startsWith('//') || /[\\\u0000-\u001f]/.test(next)) return FALLBACK;

  const { origin, pathname } = new URL(next, BASE);
  if (origin !== BASE) return FALLBACK;

  // Sending a signed-in person back to sign-in would loop.
  if (pathname === '/sign-in') return FALLBACK;

  return next;
}
