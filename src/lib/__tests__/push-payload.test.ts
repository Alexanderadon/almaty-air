/**
 * Тесты guard'а пейлоада push-уведомления (используется в src/app/sw.ts):
 * JSON-литералы (`null`, число, строка, boolean) — валидный JSON, но чтение
 * .title на них либо бросает TypeError (null), либо даёт пустое уведомление.
 * Guard пропускает только не-null объекты.
 */

import { describe, expect, it } from 'vitest';

import { parsePushPayload } from '../push-payload';

describe('parsePushPayload — guard пейлоада в сервис-воркере', () => {
  it('обычный пейлоад бэкенда проходит без изменений', () => {
    const payload = {
      title: 'Алмалинский район: воздух стал вредным',
      body: 'AQI 112 — Вредно для чувствительных.',
      url: '/district/almaly',
      tag: 'district-almaly',
    };
    expect(parsePushPayload(payload)).toBe(payload);
  });

  it('частичный объект тоже проходит (поля опциональны)', () => {
    expect(parsePushPayload({})).toEqual({});
    expect(parsePushPayload({ title: 'x' })).toEqual({ title: 'x' });
  });

  it.each([
    ['JSON-литерал null (падал с TypeError вне try/catch)', null],
    ['число', 42],
    ['строка', 'garbage'],
    ['boolean', true],
    ['undefined', undefined],
  ])('не-объект отклоняется: %s', (_label, value) => {
    expect(parsePushPayload(value)).toBeNull();
  });
});
