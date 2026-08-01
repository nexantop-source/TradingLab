import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma único.
 * En desarrollo se guarda en `globalThis` para que la recarga en caliente de
 * Next.js no abra una conexión nueva en cada cambio.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
