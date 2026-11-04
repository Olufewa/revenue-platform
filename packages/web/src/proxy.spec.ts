import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { secondsFromNow, testToken } from './lib/test-token';
import { proxy } from './proxy';

const access = (seconds: number) =>
  testToken({ email: 'ada@mtn.test', exp: secondsFromNow(seconds) });
const valid = access(900);
const expired = access(-60);
const newAccess = access(901);

const refreshOk = () =>
  new Response(
    JSON.stringify({
      access_token: newAccess,
      refresh_token: 'new-refresh',
      refresh_expires_in: 604800,
    }),
  );
const refreshRejected = () => new Response('{}', { status: 401 });

const fetchMock = vi.fn();

function run(
  path: string,
  cookies: { access?: string; refresh?: string } = {},
  headers: HeadersInit = {},
) {
  const request = new NextRequest(`http://localhost:3001${path}`, { headers });
  if (cookies.access) request.cookies.set('rp_session', cookies.access);
  if (cookies.refresh) request.cookies.set('rp_refresh', cookies.refresh);
  return proxy(request);
}

const location = (response: Response) => response.headers.get('location');
const forwarded = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);
const passedThrough = (response: Response) =>
  response.headers.get('x-middleware-next') === '1';
const rewrittenTo = (response: Response) =>
  response.headers.get('x-middleware-rewrite');
const setCookies = (response: Response) =>
  response.headers.getSetCookie().join('\n');

describe('proxy', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('/api with a valid access token', () => {
    it('adds the bearer token without refreshing', async () => {
      const response = await run('/api/services', {
        access: valid,
        refresh: 'current',
      });

      expect(rewrittenTo(response)).toBe('http://api.test/services');
      expect(forwarded(response, 'authorization')).toBe(`Bearer ${valid}`);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps the query string and strips the /api prefix', async () => {
      const response = await run('/api/services/a/orders?page=2&x=%20y', {
        access: valid,
      });

      expect(rewrittenTo(response)).toBe(
        'http://api.test/services/a/orders?page=2&x=%20y',
      );
    });

    it('replaces an Authorization header sent by the client', async () => {
      const response = await run(
        '/api/services',
        { access: valid },
        { authorization: 'Bearer from-client' },
      );

      expect(forwarded(response, 'authorization')).toBe(`Bearer ${valid}`);
    });
  });

  describe('/api never forwards cookies', () => {
    it.each([
      ['with a session', { access: valid, refresh: 'current' }],
      ['with only a refresh token', { refresh: 'current' }],
      ['with no session', {}],
    ])('%s', async (_label, cookies) => {
      fetchMock.mockResolvedValue(refreshRejected());

      const response = await run('/api/services', cookies, {
        cookie: 'rp_refresh=current',
      });

      expect(forwarded(response, 'cookie')).toBeNull();
      expect(
        response.headers.get('x-middleware-override-headers'),
      ).not.toContain('cookie');
    });
  });

  describe('when the access token has expired', () => {
    it('refreshes, and uses the new token on this API call', async () => {
      fetchMock.mockResolvedValue(refreshOk());

      const response = await run('/api/services', {
        access: expired,
        refresh: 'current',
      });

      expect(forwarded(response, 'authorization')).toBe(`Bearer ${newAccess}`);
      expect(setCookies(response)).toContain(`rp_session=${newAccess}`);
      expect(setCookies(response)).toContain('rp_refresh=new-refresh');
      expect(setCookies(response)).toMatch(/HttpOnly/i);
    });

    it('refreshes when the access cookie is gone altogether', async () => {
      fetchMock.mockResolvedValue(refreshOk());

      const response = await run('/services', { refresh: 'current' });

      expect(passedThrough(response)).toBe(true);
      expect(setCookies(response)).toContain(`rp_session=${newAccess}`);
    });

    it('refreshes a token about to expire', async () => {
      fetchMock.mockResolvedValue(refreshOk());

      await run('/services', { access: access(5), refresh: 'current' });

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('passes the new tokens to server components on this request', async () => {
      fetchMock.mockResolvedValue(refreshOk());

      const response = await run('/services', { refresh: 'current' });

      expect(forwarded(response, 'cookie')).toContain(
        `rp_session=${newAccess}`,
      );
      expect(forwarded(response, 'cookie')).toContain('rp_refresh=new-refresh');
    });

    it('skips the sign-in page when the refresh works', async () => {
      fetchMock.mockResolvedValue(refreshOk());

      const response = await run('/sign-in', { refresh: 'current' });

      expect(location(response)).toBe('http://localhost:3001/services');
      expect(setCookies(response)).toContain(`rp_session=${newAccess}`);
    });

    it('signs out and clears both cookies when refused', async () => {
      fetchMock.mockResolvedValue(refreshRejected());

      const response = await run('/services', {
        access: expired,
        refresh: 'spent',
      });

      expect(location(response)).toContain('/sign-in');
      expect(setCookies(response)).toMatch(/rp_session=;/);
      expect(setCookies(response)).toMatch(/rp_refresh=;/);
    });

    it('sends /api through unauthenticated when refused', async () => {
      fetchMock.mockResolvedValue(refreshRejected());

      const response = await run('/api/services', { refresh: 'spent' });

      expect(rewrittenTo(response)).toBe('http://api.test/services');
      expect(forwarded(response, 'authorization')).toBeNull();
      expect(setCookies(response)).toMatch(/rp_refresh=;/);
    });

    it('keeps the refresh cookie when the API is unavailable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const response = await run('/services', { refresh: 'current' });

      expect(location(response)).toContain('/sign-in');
      expect(setCookies(response)).toBe('');
    });

    it('uses a still-valid token if refreshing is unavailable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const token = access(5);
      const response = await run('/api/services', {
        access: token,
        refresh: 'current',
      });

      expect(forwarded(response, 'authorization')).toBe(`Bearer ${token}`);
    });

    it('clears an expired cookie when there is no refresh token', async () => {
      const response = await run('/services', { access: expired });

      expect(location(response)).toContain('/sign-in');
      expect(setCookies(response)).toMatch(/rp_session=;/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it.each(['/session', '/design-system'])(
    'leaves %s open and never refreshes there',
    async (path) => {
      const response = await run(path, { refresh: 'current' });

      expect(passedThrough(response)).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('does not treat a lookalike path as public', async () => {
    expect(location(await run('/sessions'))).toContain('/sign-in');
    expect(location(await run('/apifoo'))).toContain('/sign-in');
  });

  describe('/sign-in', () => {
    it('shows the page when signed out', async () => {
      expect(passedThrough(await run('/sign-in'))).toBe(true);
      expect(passedThrough(await run('/sign-in', { access: expired }))).toBe(
        true,
      );
    });

    it('sends a signed-in person onward', async () => {
      expect(location(await run('/sign-in', { access: valid }))).toBe(
        'http://localhost:3001/services',
      );
      expect(
        location(
          await run('/sign-in?next=/services/a/orders', { access: valid }),
        ),
      ).toBe('http://localhost:3001/services/a/orders');
    });

    it('ignores an unsafe next', async () => {
      expect(
        location(await run('/sign-in?next=//evil.com', { access: valid })),
      ).toBe('http://localhost:3001/services');
    });
  });

  describe('pages', () => {
    it('lets a signed-in person through', async () => {
      expect(passedThrough(await run('/services', { access: valid }))).toBe(
        true,
      );
    });

    it('redirects when signed out, keeping the path and query', async () => {
      const url = new URL(location(await run('/services/a/orders?page=2'))!);

      expect(url.pathname).toBe('/sign-in');
      expect(url.searchParams.get('next')).toBe('/services/a/orders?page=2');
    });

    it('adds no next for the home page', async () => {
      expect(location(await run('/'))).toBe('http://localhost:3001/sign-in');
    });
  });
});
