import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('api', () => {
  const fetchMock = vi.fn();
  const assign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: {
        pathname: '/services/svc_1/orders',
        search: '?page=2',
        assign,
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('calls through the /api prefix and returns the JSON', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'svc_1' }));

    await expect(api('/services/svc_1')).resolves.toEqual({ id: 'svc_1' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/services/svc_1');
  });

  it('joins validation messages', async () => {
    fetchMock.mockResolvedValue(json(400, { message: ['one', 'two'] }));

    await expect(api('/services')).rejects.toMatchObject({
      status: 400,
      message: 'one, two',
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not expose a raw proxy error page', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>oops</html>', { status: 500 }),
    );

    await expect(api('/services')).rejects.toMatchObject({
      message: 'Something went wrong on the server. Try again soon.',
    });
  });

  it('on a 401, clears the session and returns here after sign-in', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { message: 'Invalid or expired token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api('/services')).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledWith('/session', { method: 'DELETE' });
    expect(assign).toHaveBeenCalledWith(
      '/sign-in?next=%2Fservices%2Fsvc_1%2Forders%3Fpage%3D2',
    );
  });
});
