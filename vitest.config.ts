import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Зеркало paths из tsconfig.json — для импортов '@/…' в тестах компонентов.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Базовое окружение — node (тесты data-слоя); тесты компонентов включают
    // jsdom точечно через комментарий `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
