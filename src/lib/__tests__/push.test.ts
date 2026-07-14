/**
 * Тесты push-модуля: детекция пересечения границы «вредного» воздуха,
 * кулдаун подписок, чистка мёртвых endpoint'ов (404/410), валидация
 * подписки из клиента и деградация без VAPID-ключей.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFY_COOLDOWN_MS,
  NO_HISTORY_AQI,
  UNHEALTHY_AQI,
  buildDeteriorationPayload,
  crossedIntoUnhealthy,
  getPushConfig,
  notifyOnDeterioration,
  parsePushSubscription,
  shouldNotifySubscription,
} from '../push';
import type { CityAir, DistrictAir, DistrictSlug } from '../types';
import { DISTRICT_SLUGS } from '../types';

// Prisma и web-push мокаем целиком: тесты проверяют логику рассылки,
// а не сеть/БД. vi.hoisted — фабрики vi.mock исполняются раньше импортов.
const { readingFindFirst, subFindMany, subUpdate, subDeleteMany, getPrisma, sendNotification } =
  vi.hoisted(() => {
    const readingFindFirst = vi.fn();
    const subFindMany = vi.fn();
    const subUpdate = vi.fn();
    const subDeleteMany = vi.fn();
    return {
      readingFindFirst,
      subFindMany,
      subUpdate,
      subDeleteMany,
      getPrisma: vi.fn(() => ({
        reading: { findFirst: readingFindFirst },
        pushSubscription: {
          findMany: subFindMany,
          update: subUpdate,
          deleteMany: subDeleteMany,
        },
      })),
      sendNotification: vi.fn(),
    };
  });

vi.mock('../db', () => ({ getPrisma }));
vi.mock('web-push', () => ({ default: { sendNotification } }));

const ENV_KEYS = ['VAPID_SUBJECT', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const;
const savedEnv = new Map<string, string | undefined>();

function setVapidEnv() {
  process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
}

function districtOf(slug: DistrictSlug, aqi: number | null): DistrictAir {
  return {
    slug,
    aqi,
    pm25: aqi === null ? null : 40,
    dominant: aqi === null ? null : 'pm25',
    stationCount: aqi === null ? 0 : 2,
    dataOrigin: 'stations',
    observedAt: aqi === null ? null : '2026-07-14T09:20:00.000Z',
  };
}

/** CityAir, где заданные районы имеют указанный AQI, остальные — null (пропускаются). */
function cityAirWith(aqiBySlug: Partial<Record<DistrictSlug, number>>): CityAir {
  return {
    updatedAt: '2026-07-14T09:37:12.345Z',
    citywide: { aqi: null, pm25: null },
    districts: DISTRICT_SLUGS.map((slug) => districtOf(slug, aqiBySlug[slug] ?? null)),
    stations: [],
    sources: [],
    modelOnly: false,
  };
}

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1), // BigInt-литералы недоступны при target ES2017

    districtSlug: 'almaly',
    endpoint: 'https://push.example.com/sub/1',
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    lastNotifiedAt: null,
    lastNotifiedCategory: null,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  setVapidEnv();
  readingFindFirst.mockReset().mockResolvedValue(null);
  subFindMany.mockReset().mockResolvedValue([]);
  subUpdate.mockReset().mockResolvedValue({});
  subDeleteMany.mockReset().mockResolvedValue({ count: 1 });
  getPrisma.mockClear();
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201, body: '', headers: {} });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.useRealTimers();
});

describe('crossedIntoUnhealthy — детекция пересечения границы 101', () => {
  it.each([
    [112, 68, true], // ухудшение 68 → 112: пересёк границу
    [110, 112, false], // стабильно вредно 112 → 110: пересечения нет
    [155, null, true], // без истории, но явное «Вредно» (≥ 151)
    [105, null, false], // без истории и ниже 151 — не спамим на первом запуске
    [100, 50, false], // не дотянул до границы
    [101, 100, true], // ровно на границе — пересёк
    [151, null, true], // ровно порог первого запуска
    [150, null, false],
    [null, 50, false], // текущего значения нет — уведомлять не о чем
    [180, 120, false], // ухудшение внутри «вредной» зоны — границу не пересекал
  ])('current=%s, previous=%s → %s', (current, previous, expected) => {
    expect(crossedIntoUnhealthy(current, previous)).toBe(expected);
  });

  it('пороги согласованы со шкалой: 101 — вход в usg, 151 — вход в unhealthy', () => {
    expect(UNHEALTHY_AQI).toBe(101);
    expect(NO_HISTORY_AQI).toBe(151);
  });
});

describe('shouldNotifySubscription — кулдаун 6 часов', () => {
  const now = new Date('2026-07-14T12:00:00.000Z');

  it('ни разу не уведомляли — слать', () => {
    expect(
      shouldNotifySubscription({ lastNotifiedAt: null, lastNotifiedCategory: null }, 'usg', now),
    ).toBe(true);
  });

  it('уведомляли 3 часа назад в той же категории — не слать', () => {
    const sub = {
      lastNotifiedAt: new Date(now.getTime() - 3 * 3_600_000),
      lastNotifiedCategory: 'usg',
    };
    expect(shouldNotifySubscription(sub, 'usg', now)).toBe(false);
  });

  it('уведомляли 7 часов назад — слать снова', () => {
    const sub = {
      lastNotifiedAt: new Date(now.getTime() - 7 * 3_600_000),
      lastNotifiedCategory: 'usg',
    };
    expect(shouldNotifySubscription(sub, 'usg', now)).toBe(true);
  });

  it('ровно 6 часов — граница включительно, слать', () => {
    const sub = {
      lastNotifiedAt: new Date(now.getTime() - NOTIFY_COOLDOWN_MS),
      lastNotifiedCategory: 'usg',
    };
    expect(shouldNotifySubscription(sub, 'usg', now)).toBe(true);
  });

  it('внутри кулдауна, но категория сменилась — слать', () => {
    const sub = {
      lastNotifiedAt: new Date(now.getTime() - 3_600_000),
      lastNotifiedCategory: 'usg',
    };
    expect(shouldNotifySubscription(sub, 'unhealthy', now)).toBe(true);
  });
});

describe('buildDeteriorationPayload — формат согласован с sw.ts', () => {
  it('заголовок с именем района, тело с AQI и категорией, url и tag по slug', () => {
    const payload = buildDeteriorationPayload('almaly', 'Алмалинский район', 112);
    expect(payload.title).toBe('Алмалинский район: воздух стал вредным');
    expect(payload.body).toContain('AQI 112');
    expect(payload.body).toContain('Вредно для чувствительных');
    expect(payload.url).toBe('/district/almaly');
    expect(payload.tag).toBe('district-almaly');
  });

  it('в теле — только первое предложение рекомендации (короткий push)', () => {
    const payload = buildDeteriorationPayload('medeu', 'Медеуский район', 160);
    expect(payload.body).toContain('AQI 160 — Вредно.');
    // Полная рекомендация unhealthy состоит из двух предложений — второго нет.
    expect(payload.body).not.toContain('маска FFP2');
  });
});

describe('parsePushSubscription — не доверяем клиенту', () => {
  const valid = {
    endpoint: 'https://push.example.com/sub/abc',
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  };

  it('валидная подписка проходит и сужается до контракта', () => {
    expect(parsePushSubscription({ ...valid, expirationTime: null, extra: 1 })).toEqual(valid);
  });

  it.each([
    ['null', null],
    ['строка', 'garbage'],
    ['число', 42],
    ['пустой объект', {}],
    ['endpoint не строка', { ...valid, endpoint: 123 }],
    ['endpoint не URL', { ...valid, endpoint: 'not-a-url' }],
    ['endpoint не https', { ...valid, endpoint: 'http://push.example.com/sub' }],
    ['endpoint слишком длинный', { ...valid, endpoint: `https://x.example/${'a'.repeat(2000)}` }],
    ['без keys', { endpoint: valid.endpoint }],
    ['keys не объект', { endpoint: valid.endpoint, keys: 'nope' }],
    ['пустой p256dh', { endpoint: valid.endpoint, keys: { p256dh: '', auth: 'a' } }],
    ['auth не строка', { endpoint: valid.endpoint, keys: { p256dh: 'k', auth: 7 } }],
    ['auth слишком длинный', { endpoint: valid.endpoint, keys: { p256dh: 'k', auth: 'a'.repeat(513) } }],
  ])('мусор отклоняется: %s', (_label, value) => {
    expect(parsePushSubscription(value)).toBeNull();
  });
});

describe('getPushConfig — деградация без env', () => {
  it('все три переменные заданы — конфиг собран', () => {
    expect(getPushConfig()).toEqual({
      subject: 'mailto:test@example.com',
      publicKey: 'test-public-key',
      privateKey: 'test-private-key',
    });
  });

  it.each(ENV_KEYS)('без %s — null (push отключён)', (key) => {
    delete process.env[key];
    expect(getPushConfig()).toBeNull();
  });
});

describe('notifyOnDeterioration — рассылка', () => {
  it('ухудшение 68 → 112: шлёт подписке района, обновляет lastNotified*', async () => {
    readingFindFirst.mockResolvedValue({ aqi: 68 });
    subFindMany.mockResolvedValue([subscriptionRow()]);

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 112 }));

    expect(result).toMatchObject({
      configured: true,
      crossed: ['almaly'],
      notified: 1,
      removed: 0,
    });

    // Предыдущий срез ищется строго ДО часа снимка (сборщик уже записал текущий час).
    expect(readingFindFirst).toHaveBeenCalledWith({
      where: { districtSlug: 'almaly', ts: { lt: new Date('2026-07-14T09:00:00.000Z') } },
      orderBy: { ts: 'desc' },
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payloadJson, options] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: 'https://push.example.com/sub/1',
      keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
    });
    const payload = JSON.parse(payloadJson as string) as Record<string, string>;
    expect(payload.title).toContain('воздух стал вредным');
    expect(payload.url).toBe('/district/almaly');
    expect(payload.tag).toBe('district-almaly');
    expect(options).toMatchObject({
      vapidDetails: {
        subject: 'mailto:test@example.com',
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
      },
    });

    expect(subUpdate).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub/1' },
      data: {
        lastNotifiedAt: expect.any(Date),
        lastNotifiedCategory: 'usg',
      },
    });
  });

  it('стабильно вредно 112 → 110: пересечения нет, ничего не шлёт', async () => {
    readingFindFirst.mockResolvedValue({ aqi: 112 });
    subFindMany.mockResolvedValue([subscriptionRow()]);

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 110 }));

    expect(result.crossed).toEqual([]);
    expect(result.notified).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    // До запроса подписок дело не дошло.
    expect(subFindMany).not.toHaveBeenCalled();
  });

  it('без предыдущего среза и AQI 155 — уведомляет', async () => {
    readingFindFirst.mockResolvedValue(null);
    subFindMany.mockResolvedValue([subscriptionRow()]);

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 155 }));

    expect(result.crossed).toEqual(['almaly']);
    expect(result.notified).toBe(1);
    expect(subUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastNotifiedCategory: 'unhealthy' }),
      }),
    );
  });

  it('без предыдущего среза и AQI 105 — молчит (анти-спам первого запуска)', async () => {
    readingFindFirst.mockResolvedValue(null);
    subFindMany.mockResolvedValue([subscriptionRow()]);

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 105 }));

    expect(result.crossed).toEqual([]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('предыдущий срез с aqi null трактуется как отсутствие истории', async () => {
    readingFindFirst.mockResolvedValue({ aqi: null });

    const withUnhealthy = await notifyOnDeterioration(cityAirWith({ almaly: 105 }));
    expect(withUnhealthy.crossed).toEqual([]);

    subFindMany.mockResolvedValue([subscriptionRow()]);
    const withSevere = await notifyOnDeterioration(cityAirWith({ almaly: 160 }));
    expect(withSevere.crossed).toEqual(['almaly']);
  });

  it('кулдаун: свежеуведомлённая подписка пропускается, просроченная — уведомляется', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'));
    readingFindFirst.mockResolvedValue({ aqi: 68 });
    subFindMany.mockResolvedValue([
      subscriptionRow({
        endpoint: 'https://push.example.com/sub/fresh',
        lastNotifiedAt: new Date('2026-07-14T08:00:00.000Z'), // 2 часа назад
        lastNotifiedCategory: 'usg',
      }),
      subscriptionRow({
        endpoint: 'https://push.example.com/sub/stale',
        lastNotifiedAt: new Date('2026-07-14T03:00:00.000Z'), // 7 часов назад
        lastNotifiedCategory: 'usg',
      }),
    ]);

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 112 }));

    expect(result.notified).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({
      endpoint: 'https://push.example.com/sub/stale',
    });
  });

  it('внутри кулдауна, но категория сменилась — уведомляет', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'));
    readingFindFirst.mockResolvedValue({ aqi: 95 });
    subFindMany.mockResolvedValue([
      subscriptionRow({
        lastNotifiedAt: new Date('2026-07-14T09:30:00.000Z'),
        lastNotifiedCategory: 'usg',
      }),
    ]);

    // 160 — категория unhealthy, отличается от usg в lastNotifiedCategory.
    const result = await notifyOnDeterioration(cityAirWith({ almaly: 160 }));

    expect(result.notified).toBe(1);
  });

  it('404/410 от пуш-сервиса — подписка удаляется, остальные получают своё', async () => {
    readingFindFirst.mockResolvedValue({ aqi: 68 });
    subFindMany.mockResolvedValue([
      subscriptionRow({ endpoint: 'https://push.example.com/sub/dead' }),
      subscriptionRow({ endpoint: 'https://push.example.com/sub/alive' }),
    ]);
    const gone = Object.assign(new Error('Gone'), { statusCode: 410 });
    sendNotification
      .mockRejectedValueOnce(gone)
      .mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 112 }));

    expect(result.removed).toBe(1);
    expect(result.notified).toBe(1);
    expect(subDeleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/sub/dead' },
    });
    // Мёртвой подписке lastNotified* не обновляли.
    expect(subUpdate).toHaveBeenCalledTimes(1);
    expect(subUpdate.mock.calls[0][0].where).toEqual({
      endpoint: 'https://push.example.com/sub/alive',
    });
  });

  it('прочие ошибки доставки: подписка не удаляется, рассылка не прерывается', async () => {
    readingFindFirst.mockResolvedValue({ aqi: 68 });
    subFindMany.mockResolvedValue([
      subscriptionRow({ endpoint: 'https://push.example.com/sub/flaky' }),
      subscriptionRow({ endpoint: 'https://push.example.com/sub/ok' }),
    ]);
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('Server error'), { statusCode: 500 }))
      .mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 112 }));

    expect(result.removed).toBe(0);
    expect(result.notified).toBe(1);
    expect(subDeleteMany).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('несколько районов: уведомляются только пересёкшие границу', async () => {
    // almaly 68→112 (пересёк), medeu 130→140 (уже был вредным), bostandyk 40→90 (не вредный).
    readingFindFirst.mockImplementation(({ where }: { where: { districtSlug: string } }) =>
      Promise.resolve(
        { almaly: { aqi: 68 }, medeu: { aqi: 130 } }[where.districtSlug] ?? null,
      ),
    );
    subFindMany.mockResolvedValue([subscriptionRow()]);

    const result = await notifyOnDeterioration(
      cityAirWith({ almaly: 112, medeu: 140, bostandyk: 90 }),
    );

    expect(result.crossed).toEqual(['almaly']);
    // Подписки запрашивались только для пересёкшего района.
    expect(subFindMany).toHaveBeenCalledTimes(1);
    expect(subFindMany).toHaveBeenCalledWith({ where: { districtSlug: 'almaly' } });
  });

  it('без VAPID-ключей — configured:false, БД и web-push не трогаются', async () => {
    delete process.env.VAPID_PRIVATE_KEY;

    const result = await notifyOnDeterioration(cityAirWith({ almaly: 180 }));

    expect(result).toEqual({ configured: false, crossed: [], notified: 0, removed: 0 });
    expect(getPrisma).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
