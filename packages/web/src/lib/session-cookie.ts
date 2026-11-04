import type { NextResponse } from 'next/server';
import { readClaims, type SessionClaims } from './jwt';

export const SESSION_COOKIE = 'rp_session';
export const REFRESH_COOKIE = 'rp_refresh';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Lifetime of the refresh token, in seconds. */
  refreshExpiresIn: number;
  session: SessionClaims;
}

/** The claims of a session token, or null if it is missing, malformed or expired. */
export function readSession(
  token: string | undefined,
  now = Date.now(),
): SessionClaims | null {
  if (!token) return null;

  const claims = readClaims(token);
  return claims && claims.exp * 1000 > now ? claims : null;
}

/** Validates the tokens in an API response, or null if any are unusable. */
export function parseTokens(body: unknown): SessionTokens | null {
  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    refresh_expires_in: refreshExpiresIn,
  } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof accessToken !== 'string' ||
    typeof refreshToken !== 'string' ||
    !refreshToken ||
    typeof refreshExpiresIn !== 'number' ||
    refreshExpiresIn <= 0
  ) {
    return null;
  }

  const session = readSession(accessToken);
  return session && { accessToken, refreshToken, refreshExpiresIn, session };
}

/**
 * Page scripts can't read the cookies (`httpOnly`), and cross-site POSTs don't
 * carry them (`lax`), which protects the proxied API from CSRF.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  } as const;
}

export function setSessionCookies(
  response: NextResponse,
  { accessToken, refreshToken, refreshExpiresIn, session }: SessionTokens,
  now = Date.now(),
) {
  response.cookies.set(
    SESSION_COOKIE,
    accessToken,
    cookieOptions(Math.floor(session.exp - now / 1000)),
  );
  response.cookies.set(
    REFRESH_COOKIE,
    refreshToken,
    cookieOptions(refreshExpiresIn),
  );
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}
