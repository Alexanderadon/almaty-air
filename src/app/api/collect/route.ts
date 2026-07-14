/**
 * POST /api/collect — почасовой сборщик (дергается GitHub Actions по крону).
 *
 * Авторизация: заголовок x-collect-secret сравнивается с env COLLECT_SECRET
 * через timingSafeEqual поверх SHA-256-хэшей (выравнивает длину и защищает
 * от таймингового перебора). Без секрета в env эндпоинт всегда отвечает 401.
 *
 * Поток: getCityAir() → срез в readings → push-уведомления об ухудшении.
 * Ошибки наружу не протекают — только безопасное сообщение и код 500.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { saveCityAirSnapshot } from '@/lib/history';
import { notifyOnDeterioration } from '@/lib/push';
import { getCityAir } from '@/lib/sources';

export const dynamic = 'force-dynamic';

/** Сравнение секретов за постоянное время: SHA-256 выравнивает длины входов. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.COLLECT_SECRET;
  const provided = request.headers.get('x-collect-secret');

  if (!expected || provided === null || !secretsMatch(provided, expected)) {
    return Response.json(
      { error: 'Неверный или отсутствующий x-collect-secret.' },
      { status: 401 },
    );
  }

  try {
    const air = await getCityAir();
    const snapshot = await saveCityAirSnapshot(air);
    const push = await notifyOnDeterioration(air);

    return Response.json({
      savedDistricts: snapshot.saved,
      pruned: snapshot.pruned,
      notified: push.notified,
      modelOnly: air.modelOnly,
      at: air.updatedAt,
    });
  } catch (error) {
    // Детали (стек, строки подключения) — только в лог, наружу не отдаём.
    console.error('collect: сбор не удался:', error);
    return Response.json(
      { error: 'Внутренняя ошибка сбора данных.' },
      { status: 500 },
    );
  }
}
