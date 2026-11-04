const API_URL = process.env.API_URL ?? 'http://localhost:3003';

type Auth = { token?: string; apiKey?: string };

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, label: string) {
    super(`${label} → ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

export async function api(method: string, path: string, auth: Auth = {}, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth.apiKey) headers['x-api-key'] = auth.apiKey;

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text, `${method} ${path}`);
  return text ? JSON.parse(text) : null;
}

export async function loginOrRegister(email: string, password: string): Promise<string> {
  try {
    const { access_token } = await api('POST', '/auth/login', {}, { email, password });
    return access_token;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }

  await api('POST', '/auth/register', {}, { email, password, name: 'Simulator Demo' });
  const { access_token } = await api('POST', '/auth/login', {}, { email, password });
  return access_token;
}
