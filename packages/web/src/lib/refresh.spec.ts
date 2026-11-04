import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeRefreshToken } from './refresh';
import { secondsFromNow, testToken } from './test-token';

const fetchMock = vi.fn();
const body = {
  access_token: testToken({ email: 'ada@mtn.test', exp: secondsFromNow(900) }),
  refresh_token: 'next',
  refresh_expires_in: 604800,
};
const reply = (status: number, json: unknown) =>
  new Response(JSON.stringify(json), { status });

describe('exchangeRefreshToken', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the token to the API and returns the new pair', async () => {
    fetchMock.mockResolvedValue(reply(200, body));

    const result = await exchangeRefreshToken('current');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/auth/refresh');
    expect(JSON.parse(init.body)).toEqual({ refresh_token: 'current' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      status: 'ok',
      tokens: { refreshToken: 'next', refreshExpiresIn: 604800 },
    });
  });

  it('reports a 401 as rejected', async () => {
    fetchMock.mockResolvedValue(reply(401, { message: 'no' }));

    expect(await exchangeRefreshToken('t')).toEqual({ status: 'rejected' });
  });

  it.each([
    ['a server error', () => Promise.resolve(reply(500, {}))],
    ['a network failure', () => Promise.reject(new TypeError('failed'))],
    ['a timeout', () => Promise.reject(new DOMException('', 'TimeoutError'))],
    ['an unusable response', () => Promise.resolve(reply(200, {}))],
    ['a non-JSON response', () => Promise.resolve(new Response('<html>'))],
  ])('reports %s as unavailable, not rejected', async (_label, respond) => {
    fetchMock.mockImplementation(respond);

    expect(await exchangeRefreshToken('t')).toEqual({ status: 'unavailable' });
  });
});
