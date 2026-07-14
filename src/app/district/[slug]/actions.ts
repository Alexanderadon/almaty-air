'use server';

/**
 * Server Actions страницы района: подписка/отписка push-уведомлений.
 *
 * Каждый экшен — публичная POST-точка, клиентскому вводу не доверяем:
 * slug сверяется с DISTRICT_SLUGS, подписка валидируется целиком
 * (parsePushSubscription — включая allowlist хостов push-сервисов).
 * Ошибки БД наружу не протекают — только безопасные русские сообщения
 * в структурированном результате.
 */

import { getPrisma } from '@/lib/db';
import { parsePushSubscription } from '@/lib/push';
import { DISTRICT_SLUGS } from '@/lib/types';

export interface SubscriptionActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Глобальный потолок числа подписок. Экшен публичный и без аутентификации —
 * без потолка бот может раздуть таблицу мусорными подписками до отказа БД.
 */
const MAX_SUBSCRIPTIONS = 5000;

/**
 * Безопасное описание ошибки БД для логов: Prisma в тексте ошибок валидации
 * может дословно печатать аргументы запроса (endpoint и ключи подписки),
 * поэтому логируем только класс ошибки и код, без message.
 */
function describeDbError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? `${error.name} (${code})` : error.name;
  }
  return typeof error;
}

/**
 * Сохраняет push-подписку района (upsert по endpoint — браузер даёт одну
 * подписку на origin, повторная подписка переключает район). При смене
 * района история уведомлений сбрасывается, чтобы кулдаун прошлого района
 * не глушил первое уведомление нового. Новые подписки сверх потолка
 * отклоняются; обновление существующей — всегда разрешено.
 */
export async function subscribeToDistrict(
  slug: string,
  subscription: unknown,
): Promise<SubscriptionActionResult> {
  if (!(DISTRICT_SLUGS as readonly string[]).includes(slug)) {
    return { ok: false, error: 'Неизвестный район.' };
  }

  const parsed = parsePushSubscription(subscription);
  if (!parsed) {
    return { ok: false, error: 'Некорректная push-подписка.' };
  }

  try {
    const prisma = getPrisma();

    const total = await prisma.pushSubscription.count();
    if (total >= MAX_SUBSCRIPTIONS) {
      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint: parsed.endpoint },
      });
      if (!existing) {
        return { ok: false, error: 'Лимит подписок исчерпан, попробуйте позже.' };
      }
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.endpoint },
      create: {
        districtSlug: slug,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
      },
      update: {
        districtSlug: slug,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        lastNotifiedAt: null,
        lastNotifiedCategory: null,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error(`push: не удалось сохранить подписку: ${describeDbError(error)}`);
    return { ok: false, error: 'Не удалось сохранить подписку. Попробуйте позже.' };
  }
}

/**
 * Удаляет подписку. Требуется ПОЛНАЯ подписка (endpoint + ключи p256dh/auth),
 * а не только endpoint: одного endpoint'а недостаточно как доказательства
 * владения — утёкший из логов пуш-сервиса URL позволял бы отписывать чужие
 * браузеры (IDOR). deleteMany — идемпотентно, отсутствие записи не ошибка.
 */
export async function unsubscribe(subscription: unknown): Promise<SubscriptionActionResult> {
  const parsed = parsePushSubscription(subscription);
  if (!parsed) {
    return { ok: false, error: 'Некорректная push-подписка.' };
  }

  try {
    await getPrisma().pushSubscription.deleteMany({
      where: {
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error(`push: не удалось удалить подписку: ${describeDbError(error)}`);
    return { ok: false, error: 'Не удалось отключить уведомления. Попробуйте позже.' };
  }
}
