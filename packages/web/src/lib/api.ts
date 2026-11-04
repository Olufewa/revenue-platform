export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

/** NestJS errors carry `message` as a string, or a list for validation errors. */
function errorMessage(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(', ');
  return status >= 500
    ? 'Something went wrong on the server. Try again soon.'
    : 'That request was not accepted.';
}

/** Sends JSON to a path on this site and throws an ApiError on failure. */
export async function request<T>(
  url: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined)
    requestHeaders.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    // Not JSON, such as a proxy error page: keep the raw text.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessage(parsed, response.status),
      parsed,
    );
  }

  return parsed as T;
}

/**
 * Calls the API from a client component. `proxy.ts` adds the bearer token from
 * the session cookie. If the API rejects the token, the session is cleared and
 * the person is sent to sign in, then returned here.
 */
export async function api<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  try {
    return await request<T>(`/api${path}`, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await fetch('/session', { method: 'DELETE' });
      const { pathname, search, assign } = window.location;
      const next = encodeURIComponent(pathname + search);
      assign.call(window.location, `/sign-in?next=${next}`);
    }
    throw error;
  }
}
