// src/lib/db.ts

import { PrismaClient } from '@/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const prisma = new PrismaClient({
    // Cap the pool per instance: Fluid Compute reuses instances across
    // requests, and the Supabase pooler allows only 200 client connections.
    adapter: new PrismaPg({ connectionString, max: 5 }),
  });

  // Cache in every environment. Caching only outside production created a
  // new, never-closed pool on every call in prod, which exhausted the pooler
  // (EMAXCONN) and turned crawled pages into 404s/500s.
  globalForPrisma.prisma = prisma;

  return prisma;
}