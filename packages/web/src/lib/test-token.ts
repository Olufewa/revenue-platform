/** Builds an unsigned JWT-shaped token for tests. */
export function testToken(claims: object): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'none' })}.${encode(claims)}.signature`;
}

/** Seconds since the epoch, offset from now. */
export const secondsFromNow = (seconds: number) =>
  Math.floor(Date.now() / 1000) + seconds;
