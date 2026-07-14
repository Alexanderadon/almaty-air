/**
 * Отдельный конфиг для дымового прогона БД: живое соединение с Supabase.
 * НЕ входит в основной сьют (`pnpm test`) — запускать явно: `pnpm db:smoke`
 * из корня проекта (нужны DATABASE_URL/DIRECT_URL в .env.local).
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Prisma 7 и vitest сами .env-файлы не читают — грузим вручную (Node 20.12+).
for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // файла нет — переменные могут прийти из окружения
  }
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['scripts/db-smoke.test.ts'],
    // Живая БД за океаном — таймаут щедрее дефолтных 5 секунд.
    testTimeout: 30_000,
  },
});
