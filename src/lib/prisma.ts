import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 no longer reads the connection URL from the schema — the client
 * connects through a driver adapter that owns the pool.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

/**
 * Next.js hot-reloads server modules on every edit in development. Without a
 * cache the module would build a fresh client — and a fresh connection pool —
 * on each reload, exhausting the database's connection limit within minutes.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Alias for call sites that prefer the `db` name over `prisma`. */
export const db = prisma;
