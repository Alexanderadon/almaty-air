/** Утилиты тестов провайдеров: JSON-Response и извлечение вызванных URL. */

import type { Mock } from 'vitest';

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function calledUrls(fetchMock: Mock<FetchLike>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}
