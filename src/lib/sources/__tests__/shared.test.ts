/**
 * Тесты общей обвязки провайдеров: фильтр свежести isFresh
 * (включая границу будущего — FUTURE_SKEW_MS) и нормализация toIsoUtc.
 */

import { describe, expect, it } from 'vitest';

import { FUTURE_SKEW_MS, isFresh, STALE_LIMIT_MS, toIsoUtc } from '../shared';

const NOW_MS = Date.parse('2026-07-14T09:00:00Z');

describe('isFresh — окно свежести', () => {
  it('свежая метка в прошлом проходит', () => {
    expect(isFresh('2026-07-14T08:00:00Z', NOW_MS)).toBe(true);
  });

  it('ровно на границе трёх часов ещё проходит, старше — нет', () => {
    expect(isFresh(new Date(NOW_MS - STALE_LIMIT_MS).toISOString(), NOW_MS)).toBe(true);
    expect(isFresh(new Date(NOW_MS - STALE_LIMIT_MS - 1).toISOString(), NOW_MS)).toBe(false);
  });

  it('небольшой дрейф часов в будущее (≤ 15 мин) допустим', () => {
    expect(isFresh(new Date(NOW_MS + 10 * 60 * 1000).toISOString(), NOW_MS)).toBe(true);
    expect(isFresh(new Date(NOW_MS + FUTURE_SKEW_MS).toISOString(), NOW_MS)).toBe(true);
  });

  it('метка дальше 15 минут в будущем отбрасывается (сбой часов источника)', () => {
    expect(isFresh(new Date(NOW_MS + FUTURE_SKEW_MS + 1).toISOString(), NOW_MS)).toBe(false);
    // Классика: станция штампует локальное время Алматы (+5 ч) как UTC.
    expect(isFresh('2026-07-14T14:00:00Z', NOW_MS)).toBe(false);
  });

  it('мусорная дата из далёкого будущего отбрасывается', () => {
    expect(isFresh('2100-01-01T00:00:00Z', NOW_MS)).toBe(false);
  });

  it('неразбираемая строка отбрасывается', () => {
    expect(isFresh('не дата', NOW_MS)).toBe(false);
  });
});

describe('toIsoUtc', () => {
  it('строка без зоны трактуется как UTC (формат Open-Meteo)', () => {
    expect(toIsoUtc('2026-07-14T08:00')).toBe('2026-07-14T08:00:00.000Z');
  });

  it('смещение зоны нормализуется к UTC', () => {
    expect(toIsoUtc('2026-07-14T13:00:00+05:00')).toBe('2026-07-14T08:00:00.000Z');
  });

  it('пустая и неразбираемая строки дают null', () => {
    expect(toIsoUtc('')).toBeNull();
    expect(toIsoUtc('вчера')).toBeNull();
  });
});
