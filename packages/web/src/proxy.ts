import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from './lib/api-url';
import { exchangeRefreshToken } from './lib/refresh';
import { safeNext } from './lib/safe-next';
import {
  clearSessionCookies,
  readSession,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  setSessionCookies,
  type SessionTokens,
} from './lib/session-cookie';

/** Refresh this early, so a token can't expire while a request is in flight. */
const EXPIRY_MARGIN_MS = 10_000;

const isUnder = (pathname: string, root: string) =>
  pathname === root || pathname.startsWith(`${root}/`);

interface ResolvedSession {
  accessToken: string | null;
  /** New tokens to save, when this request refreshed the session. */
  refreshed?: SessionTokens;
  /** The session is over, so its cookies should go. */
  clear?: boolean;
}

async function resolveSession(request: NextRequest): Promise<ResolvedSession> {
  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken && readSession(accessToken, Date.now() + EXPIRY_MARGIN_MS)) {
    return { accessToken };
  }

  // Inside the margin, the old token still works if refreshing isn't possible.
  const stillValid = readSession(accessToken) ? accessToken! : null;

  if (!refreshToken) {
    return { accessToken: stillValid, clear: !stillValid && !!accessToken };
  }

  const result = await exchangeRefreshToken(refreshToken);

  switch (result.status) {
    case 'ok':
      return {
        accessToken: result.tokens.accessToken,
        refreshed: result.tokens,
      };
    case 'rejected':
      return { accessToken: null, clear: true };
    case 'unavailable':
      // An API blip shouldn't end the session, so the cookies stay.
      return { accessToken: stillValid };
  }
}

/**
 * Guards pages, keeps the session fresh, and turns the session cookie into the
 * API's bearer token. Refreshing here means client code never handles expiry.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (isUnder(pathname, '/session') || isUnder(pathname, '/design-system')) {
    return NextResponse.next();
  }

  const session = await resolveSession(request);
  const { accessToken, refreshed, clear } = session;

  const finish = (response: NextResponse) => {
    if (refreshed) setSessionCookies(response, refreshed);
    if (clear) clearSessionCookies(response);
    return response;
  };

  // New tokens must also reach this request, not only the browser, so that
  // `cookies()` in server components sees them.
  if (refreshed) {
    request.cookies.set(SESSION_COOKIE, refreshed.accessToken);
    request.cookies.set(REFRESH_COOKIE, refreshed.refreshToken);
  }

  if (isUnder(pathname, '/api')) {
    const headers = new Headers(request.headers);
    headers.delete('cookie'); // The API doesn't use them, and one is a refresh token.
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    // Rewriting here, not in next.config.ts, because Set-Cookie doesn't survive
    // a config rewrite. Losing it would leave the browser with a spent refresh
    // token, which then looks like theft.
    const target = new URL(pathname.slice('/api'.length) + search, apiUrl());
    return finish(NextResponse.rewrite(target, { request: { headers } }));
  }

  if (pathname === '/sign-in') {
    return finish(
      accessToken
        ? NextResponse.redirect(
            new URL(safeNext(searchParams.get('next')), request.url),
          )
        : NextResponse.next(),
    );
  }

  if (accessToken) {
    return finish(
      refreshed
        ? NextResponse.next({ request: { headers: request.headers } })
        : NextResponse.next(),
    );
  }

  const signIn = new URL('/sign-in', request.url);
  if (pathname !== '/') signIn.searchParams.set('next', pathname + search);
  return finish(NextResponse.redirect(signIn));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
