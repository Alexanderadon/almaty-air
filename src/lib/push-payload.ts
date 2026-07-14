/**
 * Разбор пейлоада push-уведомления на стороне сервис-воркера.
 *
 * Вынесено из src/app/sw.ts в чистый модуль без зависимостей от
 * ServiceWorkerGlobalScope/serwist, чтобы логику можно было юнит-тестировать
 * (сам sw.ts в тестовом окружении не импортируется — serwist исполняется
 * на верхнем уровне модуля и требует глобалей воркера).
 *
 * ВАЖНО: модуль попадает в бандл сервис-воркера — никаких импортов
 * серверных зависимостей (prisma, web-push) здесь быть не должно.
 */

/** Пейлоад push-уведомления, который шлёт наш бэкенд (web-push). */
export interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

/**
 * Сужает уже распарсенный JSON до PushPayload. JSON-литералы вроде `null`,
 * числа или строки — валидный JSON, но не наш пейлоад: без этого guard'а
 * чтение payload.title на `null` бросало бы TypeError уже после try/catch
 * вокруг event.data.json(), и уведомление молча не показывалось бы.
 */
export function parsePushPayload(parsed: unknown): PushPayload | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  return parsed as PushPayload;
}
