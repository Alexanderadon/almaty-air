/**
 * Тесты чистых помощников текстовой альтернативы графика AQI:
 * summarizeAqi (экстремумы серии) и dailyWorstPoints (худший час дня
 * в часовом поясе Алматы).
 */

import { describe, expect, it } from 'vitest';
import { dailyWorstPoints, summarizeAqi, type SummaryPoint } from '../summary';

const HOUR = 3_600_000;

function pt(ms: number, aqi: number | null): SummaryPoint {
  return { ms, aqi, pm25: aqi !== null ? aqi / 2 : null, pm10: null };
}

describe('summarizeAqi', () => {
  it('пустая серия — null', () => {
    expect(summarizeAqi([])).toBeNull();
  });

  it('серия из одних null — null', () => {
    expect(summarizeAqi([pt(0, null), pt(HOUR, null)])).toBeNull();
  });

  it('находит минимум, максимум и последнюю точку, пропуская null', () => {
    const points = [
      pt(0, 50),
      pt(1 * HOUR, null),
      pt(2 * HOUR, 30),
      pt(3 * HOUR, 90),
      pt(4 * HOUR, 60),
    ];
    const summary = summarizeAqi(points);
    expect(summary).not.toBeNull();
    expect(summary?.minAqi).toBe(30);
    expect(summary?.min.ms).toBe(2 * HOUR);
    expect(summary?.maxAqi).toBe(90);
    expect(summary?.max.ms).toBe(3 * HOUR);
    expect(summary?.lastAqi).toBe(60);
    expect(summary?.last.ms).toBe(4 * HOUR);
  });

  it('при равных значениях минимум и максимум — первая по времени точка', () => {
    const points = [pt(0, 40), pt(HOUR, 40)];
    const summary = summarizeAqi(points);
    expect(summary?.min.ms).toBe(0);
    expect(summary?.max.ms).toBe(0);
    expect(summary?.last.ms).toBe(HOUR);
  });
});

describe('dailyWorstPoints', () => {
  const TZ = 'Asia/Almaty'; // UTC+5, без перевода часов

  it('группирует по календарному дню часового пояса, а не по UTC', () => {
    // 18:00 UTC = 23:00 местного 10 июля; 19:00 UTC = 00:00 местного 11 июля.
    const p1 = pt(Date.UTC(2026, 6, 10, 18), 50);
    const p2 = pt(Date.UTC(2026, 6, 10, 19), 80);
    const p3 = pt(Date.UTC(2026, 6, 10, 20), 120);
    expect(dailyWorstPoints([p1, p2, p3], TZ)).toEqual([p1, p3]);
  });

  it('выбирает точку с максимальным AQI внутри дня', () => {
    const worst = pt(Date.UTC(2026, 6, 12, 6), 140);
    const points = [
      pt(Date.UTC(2026, 6, 12, 4), 60),
      worst,
      pt(Date.UTC(2026, 6, 12, 8), 90),
    ];
    expect(dailyWorstPoints(points, TZ)).toEqual([worst]);
  });

  it('день без значений представлен первой точкой — пропуск данных виден', () => {
    const gapDay = pt(Date.UTC(2026, 6, 12, 3), null);
    const points = [
      pt(Date.UTC(2026, 6, 11, 3), 70),
      gapDay,
      pt(Date.UTC(2026, 6, 12, 9), null),
    ];
    expect(dailyWorstPoints(points, TZ)).toEqual([
      points[0],
      gapDay,
    ]);
  });

  it('результат отсортирован по времени', () => {
    const points = [
      pt(Date.UTC(2026, 6, 10, 3), 30),
      pt(Date.UTC(2026, 6, 11, 3), 40),
      pt(Date.UTC(2026, 6, 12, 3), 50),
    ];
    const result = dailyWorstPoints(points, TZ);
    expect(result.map((p) => p.ms)).toEqual([...result.map((p) => p.ms)].sort((a, b) => a - b));
    expect(result).toHaveLength(3);
  });
});
