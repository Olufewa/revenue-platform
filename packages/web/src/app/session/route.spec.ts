import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { secondsFromNow, testToken } from '@/lib/test-token';
import { DELETE, POST } from './route';

const credentials = { email: 'ada@mtn.test', password: 'Password123!' };
const token = testToken({
  email: credentials.email,
  exp: secondsFromNow(900),
});
const tokens = {
  access_token: token,
  refresh_token: 'refresh-value',
  refresh_expires_in: 604800,
};

const post = (body: string = JSON.stringify(credentials)) =>
  POST(new Request('http://localhost:3001/session', { method: 'POST', body }));

const del = (refresh?: string) => {
  const request = new NextRequest('http://localhost:3001/session', {
    method: 'DELETE',
  });
  if (refresh) request.cookies.set('rp_refresh', refresh);
  return DELETE(request);
};

const apiReplies = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const cookieNamed = (response: Response, name: string) =>
  response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))!;

describe('/session', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('POST', () => {
    it('sends only the credentials to the API', async () => {
      fetchMock.mockResolvedValue(apiReplies(200, tokens));

      await post(JSON.stringify({ ...credentials, role: 'ADMIN' }));

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('http://api.test/auth/login');
      expect(JSON.parse(init.body)).toEqual(credentials);
    });

    it('sets both cookies and keeps the tokens out of the body', async () => {
      fetchMock.mockResolvedValue(apiReplies(200, tokens));

      const response = await post();

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(
        JSON.stringify({ email: credentials.email }),
      );

      const access = cookieNamed(response, 'rp_session');
      const refresh = cookieNamed(response, 'rp_refresh');
      expect(access).toContain(`rp_session=${token}`);
      expect(refresh).toContain('rp_refresh=refresh-value');

      for (const cookie of [access, refresh]) {
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=lax/i);
        expect(cookie).toContain('Path=/');
        expect(cookie).not.toMatch(/Secure/i);
      }
    });

    it('expires each cookie with its own token', async () => {
      fetchMock.mockResolvedValue(apiReplies(200, tokens));

      const response = await post();
      const maxAge = (cookie: string) =>
        Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);

      const accessAge = maxAge(cookieNamed(response, 'rp_session'));
      expect(accessAge).toBeGreaterThan(890);
      expect(accessAge).toBeLessThanOrEqual(900);
      expect(maxAge(cookieNamed(response, 'rp_refresh'))).toBe(604800);
    });

    it('marks both cookies Secure in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      fetchMock.mockResolvedValue(apiReplies(200, tokens));

      const response = await post();

      expect(cookieNamed(response, 'rp_session')).toMatch(/Secure/i);
      expect(cookieNamed(response, 'rp_refresh')).toMatch(/Secure/i);
    });

    it('passes on the API failure and sets no cookie', async () => {
      const failure = { message: 'Email or password is incorrect' };
      fetchMock.mockResolvedValue(apiReplies(401, failure));

      const response = await post();

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(failure);
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('returns 502 when the API is unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const response = await post();

      expect(response.status).toBe(502);
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it.each([
      ['no tokens', {}],
      ['a malformed access token', { ...tokens, access_token: 'garbage' }],
      [
        'an expired access token',
        {
          ...tokens,
          access_token: testToken({
            email: credentials.email,
            exp: secondsFromNow(-60),
          }),
        },
      ],
      ['no refresh token', { ...tokens, refresh_token: undefined }],
      ['an empty refresh token', { ...tokens, refresh_token: '' }],
      ['no refresh lifetime', { ...tokens, refresh_expires_in: undefined }],
    ])('returns 502 and no cookie for %s', async (_label, body) => {
      fetchMock.mockResolvedValue(apiReplies(200, body));

      const response = await post();

      expect(response.status).toBe(502);
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it.each([
      ['malformed JSON', 'not json'],
      ['a missing password', JSON.stringify({ email: credentials.email })],
      ['a non-string email', JSON.stringify({ ...credentials, email: 1 })],
      ['a null body', 'null'],
    ])('returns 400 without calling the API for %s', async (_label, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    const cleared = (response: Response) => {
      expect(response.status).toBe(204);
      expect(cookieNamed(response, 'rp_session')).toMatch(/^rp_session=;/);
      expect(cookieNamed(response, 'rp_refresh')).toMatch(/^rp_refresh=;/);
    };

    it('revokes the session on the API and clears both cookies', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      cleared(await del('current'));

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('http://api.test/auth/logout');
      expect(JSON.parse(init.body)).toEqual({ refresh_token: 'current' });
    });

    it('still clears the cookies when the API is unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      cleared(await del('current'));
    });

    it('does not call the API without a refresh token', async () => {
      cleared(await del());

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
