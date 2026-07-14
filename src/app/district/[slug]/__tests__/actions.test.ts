/**
 * Тесты server actions подписки: валидация slug и подписки (клиентскому
 * вводу не доверяем), upsert по endpoint со сбросом истории уведомлений
 * при смене района, идемпотентная отписка, безопасные ошибки БД.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeToDistrict, unsubscribe } from '../actions';

const { upsert, deleteMany, getPrisma } = vi.hoisted(() => {
  const upsert = vi.fn();
  const deleteMany = vi.fn();
  return {
    upsert,
    deleteMany,
    getPrisma: vi.fn(() => ({ pushSubscription: { upsert, deleteMany } })),
  };
});

vi.mock('@/lib/db', () => ({ getPrisma }));

const VALID_SUBSCRIPTION = {
  endpoint: 'https://push.example.com/sub/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
};

beforeEach(() => {
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
    ['без keys', { endpoint: 'https://push.example.com/sub' }],
    ['http-endpoint', { ...VALID_SUBSCRIPTION, endpoint: 'http://push.example.com/x' }],
  ])('мусорная подписка (%s) отклоняется до обращения к БД', async (_label, subscription) => {
    const result = await subscribeToDistrict('almaly', subscription);

    expect(result.ok).toBe(false);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('сбой БД — честный ok:false без деталей, ошибка в лог', async () => {
    upsert.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await subscribeToDistrict('almaly', VALID_SUBSCRIPTION);

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('duplicate key');
    expect(errorLog).toHaveBeenCalledOnce();
  });
});

describe('unsubscribe', () => {
  it('удаляет подписку по endpoint', async () => {
    const result = await unsubscribe(VALID_SUBSCRIPTION.endpoint);

    expect(result).toEqual({ ok: true });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { endpoint: VALID_SUBSCRIPTION.endpoint },
    });
  });

  it.each([
    ['не строка', 42],
    ['пустая строка', ''],
    ['слишком длинный', 'x'.repeat(2001)],
  ])('невалидный endpoint (%s) отклоняется до обращения к БД', async (_label, endpoint) => {
    const result = await unsubscribe(endpoint);

    expect(result.ok).toBe(false);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('сбой БД — ok:false с безопасным сообщением', async () => {
    deleteMany.mockRejectedValue(new Error('connection refused'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await unsubscribe(VALID_SUBSCRIPTION.endpoint);

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('connection');
    expect(errorLog).toHaveBeenCalledOnce();
  });
});
