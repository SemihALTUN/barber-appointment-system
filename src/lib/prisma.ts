// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Satır kilidi (FOR UPDATE) altında bekleyen işlemler için varsayılanlar (2s / 5s) dar kalabilir.
    transactionOptions: {
      maxWait: 5_000,
      timeout: 10_000,
    },
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Next.js dev modunda HMR her yüklemede yeni client açmasın diye singleton'ı global'e bağlıyoruz.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
