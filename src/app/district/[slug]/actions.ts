'use server';

/**
 * Server Actions страницы района: подписка/отписка push-уведомлений.
 *
 * Каждый экшен — публичная POST-точка, клиентскому вводу не доверяем:
 * slug сверяется с DISTRICT_SLUGS, подписка валидируется целиком
 * (parsePushSubscription). Ошибки БД наружу не протекают — только
 * безопасные русские сообщения в структурированном результате.
 */

import { getPrisma } from '@/lib/db';
import { parsePushSubscription } from '@/lib/push';
import { DISTRICT_SLUGS } from '@/lib/types';

export interface SubscriptionActionResult {
  ok: boolean;
  error?: string;
}

const MAX_ENDPOINT_LENGTH = 2000;

/**
 * Сохраняет push-подписку района (upsert по endpoint — браузер даёт одну
 * подписку на origin, повторная подписка переключает район). При смене
 * района история уведомлений сбрасывается, чтобы кулдаун прошлого района
 * не глушил первое уведомление нового.
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
    await getPrisma().pushSubscription.upsert({
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
    console.error('push: не удалось сохранить подписку:', error);
    return { ok: false, error: 'Не удалось сохранить подписку. Попробуйте позже.' };
  }
}

/** Удаляет подписку по endpoint (deleteMany — идемпотентно, отсутствие не ошибка). */
export async function unsubscribe(endpoint: unknown): Promise<SubscriptionActionResult> {
  if (
    typeof endpoint !== 'string' ||
    endpoint.length === 0 ||
    endpoint.length > MAX_ENDPOINT_LENGTH
  ) {
    return { ok: false, error: 'Некорректный endpoint подписки.' };
  }

  try {
    await getPrisma().pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  } catch (error) {
    console.error('push: не удалось удалить подписку:', error);
    return { ok: false, error: 'Не удалось отключить уведомления. Попробуйте позже.' };
  }
}
