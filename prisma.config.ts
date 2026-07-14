/**
 * Конфигурация Prisma CLI (Prisma 7: prisma.config.ts вместо url в схеме).
 *
 * Важно: Prisma 7 сам НЕ читает .env-файлы — загружаем их здесь вручную
 * (process.loadEnvFile доступен в Node 20.12+). Команды CLI запускать
 * из корня проекта (pnpm-скрипты делают это автоматически).
 */
import { defineConfig } from 'prisma/config';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // файла нет — не ошибка: на Vercel переменные приходят из окружения
  }
}

// CLI (db pull / db execute) ходит в Postgres напрямую (:5432), мимо
// транзакционного пулера. datasource намеренно опциональный: `prisma generate`
// URL не нужен, и сборка без DIRECT_URL не должна падать (env() из
// prisma/config бросает сразу — поэтому он здесь не используется).
const cliUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(cliUrl ? { datasource: { url: cliUrl } } : {}),
});
