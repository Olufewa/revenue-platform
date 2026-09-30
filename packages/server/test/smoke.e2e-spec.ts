import { describe, expect, it } from 'vitest';

describe('e2e database', () => {
  it('points at the test database', () => {
    expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/_e2e_\d+$/);
  });
});
