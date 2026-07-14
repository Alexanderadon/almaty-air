/**
 * Web Push: уведомления об ухудшении воздуха (фаза 4).
 *
 * Логика «честного» уведомления: район уведомляется только когда его AQI
 * ПЕРЕСЁК границу 101 («Вредно для чувствительных» и хуже) относительно
 * последнего сохранённого среза в readings. Если предыдущего среза нет
 * (первый запуск сборщика или пропуск в истории) — уведомляем только при
 * AQI ≥ 151, чтобы не рассылать спам всем подписчикам на ровном месте.
 *
 * Анти-спам на уровне подписки: повторное уведомление той же подписке —
 * только если прошло ≥ 6 часов ЛИБО категория AQI сменилась.
 *
 * VAPID-ключи берутся из env (VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY). Без них модуль не падает — push просто отключён.
 *
 * Подписки с протухшим endpoint (пуш-сервис ответил 404/410) удаляются.
 */

import webpush from 'web-push';
import { aqiCategory, type AqiCategory, type AqiCategoryKey } from './aqi';
import { getPrisma } from './db';
import { DISTRICTS } from './districts';
import { truncateToHourUtc } from './history';
import { DISTRICT_SLUGS, type CityAir, type DistrictSlug } from './types';

/** Нижняя граница «вредного» воздуха: вход в категорию usg (AQI ≥ 101). */
export const UNHEALTHY_AQI = 101;

/** Порог уведомления без предыдущего среза в БД: только явное «Вредно» (≥ 151). */
export const NO_HISTORY_AQI = 151;

/** Кулдаун повторного уведомления одной подписки при той же категории. */
export const NOTIFY_COOLDOWN_MS = 6 * 3_600_000;

/** Конфигурация VAPID из env; null — push отключён. */
export interface PushConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** Читает VAPID-настройки из env. Отсутствие любой из них — push отключён (null). */
export function getPushConfig(): PushConfig | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

/** Пейлоад push-уведомления; формат согласован с обработчиком в src/app/sw.ts. */
export interface DeteriorationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Подписка в форме, которую присылает браузер (PushSubscription.toJSON()).
 * Клиентскому вводу не доверяем — валидация в parsePushSubscription.
 */
export interface ClientPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Разумные потолки длины полей подписки — защита от мусора в БД. */
const MAX_ENDPOINT_LENGTH = 2000;
const MAX_KEY_LENGTH = 512;

/**
 * Хосты официальных push-сервисов браузеров (Chrome/FCM, Firefox/Mozilla,
 * Edge/WNS, Safari/APNs). Endpoint с любым другим хостом — не подписка
 * браузера, а потенциальный SSRF/спам-канал: наш сервер слал бы POST с
 * VAPID-подписью на произвольный URL. Матчинг — точное имя либо суффикс
 * с ведущей точкой (поддомены), чтобы fcm.googleapis.com.evil.example не прошёл.
 */
const ALLOWED_ENDPOINT_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
] as const;

/** Хост endpoint'а разрешён: совпадает с известным push-сервисом или его поддомен. */
export function isAllowedPushEndpointHost(hostname: string): boolean {
  return ALLOWED_ENDPOINT_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

/**
 * Хост endpoint'а для логов. Полный URL подписки — capability URL (владение
 * им позволяет слать пуши этому браузеру), поэтому в логи он не попадает.
 */
export function endpointHostForLog(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return '<invalid-endpoint>';
  }
}

/**
 * Валидация push-подписки из клиента: endpoint — https-URL известного
 * push-сервиса (см. ALLOWED_ENDPOINT_HOSTS), ключи p256dh/auth — непустые
 * строки разумной длины. Всё прочее — null (подписка отвергается).
 */
export function parsePushSubscription(value: unknown): ClientPushSubscription | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { endpoint?: unknown; keys?: unknown };

  if (typeof candidate.endpoint !== 'string') return null;
  if (candidate.endpoint.length === 0 || candidate.endpoint.length > MAX_ENDPOINT_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(candidate.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!isAllowedPushEndpointHost(url.hostname)) return null;

  if (typeof candidate.keys !== 'object' || candidate.keys === null) return null;
  const keys = candidate.keys as { p256dh?: unknown; auth?: unknown };
  for (const key of [keys.p256dh, keys.auth]) {
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      return null;
    }
  }

  return {
    endpoint: candidate.endpoint,
    keys: { p256dh: keys.p256dh as string, auth: keys.auth as string },
  };
}

/**
 * Пересёк ли район границу «вредного» воздуха (AQI ≥ 101) на этом срезе.
 *
 * previousAqi — AQI последнего сохранённого среза ДО текущего часа
 * (null — предыдущего среза нет либо в нём не было значения).
 * Без предыдущего значения «пересечение» не доказуемо — уведомляем только
 * при явном «Вредно» (AQI ≥ 151), чтобы первый запуск не спамил.
 */
export function crossedIntoUnhealthy(
  currentAqi: number | null,
  previousAqi: number | null,
): boolean {
  if (currentAqi === null || currentAqi < UNHEALTHY_AQI) return false;
  if (previousAqi === null) return currentAqi >= NO_HISTORY_AQI;
  return previousAqi < UNHEALTHY_AQI;
}

/** Поля подписки, влияющие на решение «слать ли повторно». */
export interface SubscriptionNotifyState {
  lastNotifiedAt: Date | null;
  lastNotifiedCategory: string | null;
}

/**
 * Можно ли слать уведомление этой подписке сейчас: ещё ни разу не слали,
 * ЛИБО прошло ≥ 6 часов, ЛИБО категория сменилась с прошлого уведомления.
 */
export function shouldNotifySubscription(
  subscription: SubscriptionNotifyState,
  categoryKey: AqiCategoryKey,
  now: Date,
): boolean {
  if (subscription.lastNotifiedAt === null) return true;
  if (now.getTime() - subscription.lastNotifiedAt.getTime() >= NOTIFY_COOLDOWN_MS) return true;
  return subscription.lastNotifiedCategory !== categoryKey;
}

/** Первое предложение рекомендации — для короткого тела уведомления. */
function shortAdvice(category: AqiCategory): string {
  const text = category.adviceRu;
  const end = text.indexOf('. ');
  return end === -1 ? text : text.slice(0, end + 1);
}

/** Собирает пейлоад уведомления об ухудшении для района. */
export function buildDeteriorationPayload(
  slug: DistrictSlug,
  nameRu: string,
  aqi: number,
): DeteriorationPayload {
  const category = aqiCategory(aqi);
  return {
    title: `${nameRu}: воздух стал вредным`,
    body: `AQI ${aqi} — ${category.labelRu}. ${shortAdvice(category)}`,
    url: `/district/${slug}`,
    tag: `district-${slug}`,
  };
}

/** Итог рассылки: сколько уведомлений ушло и сколько мёртвых подписок удалено. */
export interface NotifyResult {
  /** false — VAPID-ключи не заданы, рассылка не выполнялась. */
  configured: boolean;
  /** Районы, пересёкшие границу «вредного» воздуха на этом срезе. */
  crossed: DistrictSlug[];
  /** Успешно отправленные уведомления. */
  notified: number;
  /** Подписки, удалённые из-за ответа 404/410 от пуш-сервиса. */
  removed: number;
}

/** Русские имена районов по slug (для заголовков уведомлений). */
const NAME_BY_SLUG = new Map<DistrictSlug, string>(
  DISTRICTS.map((district) => [district.slug, district.nameRu]),
);

/**
 * Рассылает push-уведомления по районам, чей AQI пересёк границу 101 на этом
 * срезе. Вызывается сборщиком ПОСЛЕ saveCityAirSnapshot, поэтому «предыдущий»
 * срез ищется строго ДО часа текущего снимка (последняя строка readings по
 * убыванию ts). Ошибки доставки отдельной подписке не прерывают рассылку.
 */
export async function notifyOnDeterioration(air: CityAir): Promise<NotifyResult> {
  const config = getPushConfig();
  const result: NotifyResult = {
    configured: config !== null,
    crossed: [],
    notified: 0,
    removed: 0,
  };
  if (!config) return result;

  const prisma = getPrisma();
  const base = new Date(air.updatedAt);
  const hour = truncateToHourUtc(Number.isNaN(base.getTime()) ? new Date() : base);
  const now = new Date();
  const vapidDetails = {
    subject: config.subject,
    publicKey: config.publicKey,
    privateKey: config.privateKey,
  };

  for (const district of air.districts) {
    if (!(DISTRICT_SLUGS as readonly string[]).includes(district.slug)) continue;
    if (district.aqi === null || district.aqi < UNHEALTHY_AQI) continue;

    // Последний срез до текущего часа. Сборщик уже записал текущий час,
    // поэтому сравнивать надо строго с ts < hour, иначе сравним сами с собой.
    const previous = await prisma.reading.findFirst({
      where: { districtSlug: district.slug, ts: { lt: hour } },
      orderBy: { ts: 'desc' },
    });
    if (!crossedIntoUnhealthy(district.aqi, previous?.aqi ?? null)) continue;

    result.crossed.push(district.slug);

    const category = aqiCategory(district.aqi);
    const payload = buildDeteriorationPayload(
      district.slug,
      NAME_BY_SLUG.get(district.slug) ?? district.slug,
      district.aqi,
    );
    const payloadJson = JSON.stringify(payload);

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { districtSlug: district.slug },
    });

    for (const subscription of subscriptions) {
      if (!shouldNotifySubscription(subscription, category.key, now)) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payloadJson,
          // Часовые данные устаревают за час — дольше держать смысла нет.
          { vapidDetails, TTL: 3600, urgency: 'high' },
        );
        await prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: { lastNotifiedAt: now, lastNotifiedCategory: category.key },
        });
        result.notified += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: unknown }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Пуш-сервис сообщил, что подписки больше нет — чистим свою копию.
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
          result.removed += 1;
        } else {
          // Временный сбой доставки: подписку не трогаем, остальных не прерываем.
          // Сырую ошибку web-push не печатаем — она содержит полный endpoint
          // (capability URL); в лог идут только хост и статус/сообщение.
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(
            `push: не доставлено (${district.slug}, ` +
              `host=${endpointHostForLog(subscription.endpoint)}, ` +
              `status=${typeof statusCode === 'number' ? statusCode : 'n/a'}): ${reason}`,
          );
        }
      }
    }
  }

  return result;
}
