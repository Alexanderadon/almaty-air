/**
 * Синглтон PrismaClient (Prisma 7, движок client + драйвер-адаптер pg).
 *
 * Ленивая инициализация: клиент создаётся при первом обращении, а не при
 * импорте модуля — сборка страниц без DATABASE_URL не падает. Экземпляр
 * кэшируется в globalThis, чтобы dev-сервер Next.js (HMR) и переиспользуемые
 * serverless-контейнеры не плодили пулы соединений.
 *
 * Подключение — через транзакционный пулер Supabase (:6543), поэтому пул pg
 * держим в 1 соединение: лимитом клиентов управляет сам пулер.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prismaAlmatyAir?: PrismaClient };

/** PrismaClient приложения; бросает, если DATABASE_URL не задан. */
export function getPrisma(): PrismaClient {
  if (globalForPrisma.prismaAlmatyAir) return globalForPrisma.prismaAlmatyAir;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL не задан — история и push-подписки недоступны (см. .env.example).',
    );
  }

  const adapter = new PrismaPg(
    { connectionString, max: 1 },
    // Таблицы живут в схеме almaty_air, а не в public.
    { schema: 'almaty_air' },
  );
  const client = new PrismaClient({ adapter });
  globalForPrisma.prismaAlmatyAir = client;
  return client;
}
