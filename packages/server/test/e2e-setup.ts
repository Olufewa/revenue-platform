import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

/**
 * Creates a throwaway database for this run (never the dev one), applies the
 * full migration chain to it from scratch, and drops it again afterwards.
 * Only the database this run created is ever dropped.
 */
export default async function setup() {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run e2e tests');
  }

  const url = new URL(base);
  const database = `${url.pathname.slice(1)}_e2e_${Date.now()}`;
  url.pathname = `/${database}`;

  const admin = new URL(base);
  admin.pathname = '/postgres';

  await withClient(admin.toString(), (c) =>
    c.query(`CREATE DATABASE "${database}"`),
  );
  process.env.DATABASE_URL = url.toString();

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    await dropDatabase(admin.toString(), database);
    throw new Error(`prisma migrate deploy failed:\n${stderr}`);
  }

  return () => dropDatabase(admin.toString(), database);
}

async function dropDatabase(adminUrl: string, database: string) {
  await withClient(adminUrl, (c) =>
    c.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`),
  );
}

async function withClient(
  connectionString: string,
  fn: (client: pg.Client) => Promise<unknown>,
) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}
