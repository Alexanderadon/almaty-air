/**
 * Тесты server actions подписки: валидация slug и подписки (клиентскому
 * вводу не доверяем), upsert по endpoint со сбросом истории уведомлений
 * при смене района, глобальный потолок числа подписок, отписка только по
 * полной подписке (endpoint + ключи — анти-IDOR), безопасные ошибки БД.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeToDistrict, unsubscribe } from '../actions';

const { count, findUnique, upsert, deleteMany, getPrisma } = vi.hoisted(() => {
  const count = vi.fn();
  const findUnique = vi.fn();
  const upsert = vi.fn();
  const deleteMany = vi.fn();
  return {
    count,
    findUnique,
    upsert,
    deleteMany,
    getPrisma: vi.fn(() => ({
      pushSubscription: { count, findUnique, upsert, deleteMany },
    })),
  };
});

vi.mock('@/lib/db', () => ({ getPrisma }));

const VALID_SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
};

beforeEach(() => {
  count.mockReset().mockResolvedValue(0);
  findUnique.mockReset().mockResolvedValue(null);
  upsert.mockReset().mockResolvedValue({});
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
  getPrisma.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('subscribeToDistrict', () => {
  it('валидные slug и подписка — upsert по endpoint со сбросом lastNotified*', async () => {
    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: VALID_SUBSCRIPTION.endpoint },
      create: {
        districtSlug: 'almaly',
        endpoint: VALID_SUBSCRIPTION.endpoint,
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
      },
      update: {
        districtSlug: 'almaly',
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
        lastNotifiedAt: null,
        lastNotifiedCategory: null,
      },
    });
  });

  it.each([
    ['несуществующий район', 'downtown'],
    ['пустая строка', ''],
    ['инъекция', "almaly'; DROP TABLE push_subscriptions; --"],
  ])('невалидный slug (%s) отклоняется до обращения к БД', async (_label, slug) => {
    const result = await subscribeToDistrict(slug, VALID_SUBSCRIPTION);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['строка', 'garbage'],
    ['без keys', { endpoint: 'https://fcm.googleapis.com/fcm/send/x' }],
    ['http-endpoint', { ...VALID_SUBSCRIPTION, endpoint: 'http://fcm.googleapis.com/fcm/send/x' }],
    ['endpoint вне allowlist', { ...VALID_SUBSCRIPTION, endpoint: 'https://evil.example/collect' }],
  ])('мусорная подписка (%s) отклоняется до обращения к БД', async (_label, subscription) => {
    const result = await subscribeToDistrict('almaly', subscription);

    expect(result.ok).toBe(false);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('лимит подписок исчерпан, endpoint новый — честный отказ без insert', async () => {
    count.mockResolvedValue(5000);
    findUnique.mockResolvedValue(null);

    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result).toEqual({
      ok: false,
      error: 'Лимит подписок исчерпан, попробуйте позже.',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { endpoint: VALID_SUBSCRIPTION.endpoint },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('лимит исчерпан, но endpoint уже есть — обновление разрешено', async () => {
    count.mockResolvedValue(5000);
    findUnique.mockResolvedValue({ endpoint: VALID_SUBSCRIPTION.endpoint });

    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('лимит не достигнут — существование endpoint не проверяется', async () => {
    count.mockResolvedValue(4999);

    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: true });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('сбой БД — честный ok:false без деталей, в лог без endpoint и текста ошибки', async () => {
    upsert.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('duplicate key');
    expect(errorLog).toHaveBeenCalledOnce();
    // Prisma в ошибках валидации может печатать аргументы запроса —
    // логируем только класс ошибки, ни message, ни endpoint не протекают.
    const logged = errorLog.mock.calls[0].map(String).join(' ');
    expect(logged).not.toContain('duplicate key');
    expect(logged).not.toContain(VALID_SUBSCRIPTION.endpoint);
  });
});

describe('unsubscribe', () => {
  it('удаляет подписку по полному совпадению endpoint + p256dh + auth', async () => {
    const result = await unsubscribe(VALID_SUBSCRIPTION);

    expect(result).toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        endpoint: VALID_SUBSCRIPTION.endpoint,
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
      },
    });
  });

  it.each([
    ['только endpoint строкой (старый контракт) — IDOR', VALID_SUBSCRIPTION.endpoint],
    ['null', null],
    ['без keys', { endpoint: VALID_SUBSCRIPTION.endpoint }],
    ['пустой auth', { ...VALID_SUBSCRIPTION, keys: { p256dh: 'k', auth: '' } }],
    ['endpoint вне allowlist', { ...VALID_SUBSCRIPTION, endpoint: 'https://evil.example/x' }],
  ])('неполная подписка (%s) отклоняется до обращения к БД', async (_label, subscription) => {
    const result = await unsubscribe(subscription);

    expect(result.ok).toBe(false);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('сбой БД — ok:false с безопасным сообщением, лог без деталей', async () => {
    deleteMany.mockRejectedValue(new Error('connection refused'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await unsubscribe(VALID_SUBSCRIPTION);

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('connection');
    expect(errorLog).toHaveBeenCalledOnce();
    const logged = errorLog.mock.calls[0].map(String).join(' ');
    expect(logged).not.toContain('connection refused');
    expect(logged).not.toContain(VALID_SUBSCRIPTION.endpoint);
  });
});
