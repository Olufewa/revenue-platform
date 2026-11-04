import { apiUrl } from './api-url';
import { parseTokens, type SessionTokens } from './session-cookie';

const TIMEOUT_MS = 5000;

export type RefreshResult =
  | { status: 'ok'; tokens: SessionTokens }
  /** The API refused the token: the session is over. */
  | { status: 'rejected' }
  /** The API couldn't answer: the session may still be fine. */
  | { status: 'unavailable' };

export async function exchangeRefreshToken(
  refreshToken: string,
): Promise<RefreshResult> {
  try {
    const response = await fetch(`${apiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 401) return { status: 'rejected' };
    if (!response.ok) return { status: 'unavailable' };

    const tokens = parseTokens(await response.json());
    return tokens ? { status: 'ok', tokens } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
