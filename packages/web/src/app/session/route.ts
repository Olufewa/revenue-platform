import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from '@/lib/api-url';
import {
  clearSessionCookies,
  parseTokens,
  REFRESH_COOKIE,
  setSessionCookies,
} from '@/lib/session-cookie';

const LOGOUT_TIMEOUT_MS = 5000;

const message = (status: number, text: string) =>
  NextResponse.json({ message: text }, { status });

/** Signs in through the API and keeps the tokens in httpOnly cookies. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  if (typeof body?.email !== 'string' || typeof body.password !== 'string') {
    return message(400, 'Email and password are required');
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return message(502, "We can't reach the server right now. Try again soon.");
  }

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return result
      ? NextResponse.json(result, { status: response.status })
      : message(response.status, 'Sign-in failed. Try again.');
  }

  const tokens = parseTokens(result);
  if (!tokens) {
    return message(502, 'The server sent back an unusable session.');
  }

  const signedIn = NextResponse.json({ email: tokens.session.email });
  setSessionCookies(signedIn, tokens);
  return signedIn;
}

/**
 * Signs out: revokes the session on the API and clears this browser's cookies.
 * The cookies go even if the API can't be reached, so the person is signed out
 * here either way. An access token already issued works until it expires.
 */
export async function DELETE(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${apiUrl()}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
