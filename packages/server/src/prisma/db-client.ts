import type { Prisma } from '../generated/prisma/client.js';

/**
 * What repositories query through: the root PrismaService or the client
 * handed to a `$transaction` callback.
 */
export type DbClient = Prisma.TransactionClient;

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}
