export interface SessionClaims {
  email: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

/**
 * Reads a JWT's claims without verifying its signature, because the signing
 * secret belongs to the API. Use this to decide what to show, never what to
 * trust: the API verifies the token on every data request.
 */
export function readClaims(token: string): SessionClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const { email, exp } = claims as Partial<SessionClaims>;

    if (typeof email !== 'string' || typeof exp !== 'number') return null;
    return { email, exp };
  } catch {
    return null;
  }
}
