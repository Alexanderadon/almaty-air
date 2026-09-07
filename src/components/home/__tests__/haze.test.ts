/**
 * Смог в герое: чистый воздух — ничего, грязнее — плотнее, картинка
 * детерминирована по AQI, частицы не вылезают за viewBox.
 */

import { describe, expect, it } from 'vitest';

import { HAZE_BOX, hazeLevel, hazeParticles, hazeRatio, PARTICLE_TOP } from '../haze';

describe('hazeLevel', () => {
  it('без данных и на чистом воздухе — ни тумана, ни частиц', () => {
    expect(hazeLevel(null)).toEqual({ fog: 0, count: 0 });
    expect(hazeLevel(12)).toEqual({ fog: 0, count: 0 });
    expect(hazeLevel(40)).toEqual({ fog: 0, count: 0 });
  });

  it('монотонно растёт с AQI и упирается в потолок', () => {
    const levels = [60, 100, 150, 200, 300, 450].map((aqi) => hazeLevel(aqi));
    for (let i = 1; i < levels.length - 1; i += 1) {
      expect(levels[i].fog).toBeGreaterThan(levels[i - 1].fog);
      expect(levels[i].count).toBeGreaterThan(levels[i - 1].count);
    }
    // 300 и 450 — одинаковый максимум.
    expect(levels[4]).toEqual(levels[5]);
    expect(hazeRatio(450)).toBe(1);
  });

  it('«умеренно» (AQI 70) — едва заметная дымка, а не стена смога', () => {
    const { fog, count } = hazeLevel(70);
    expect(fog).toBeLessThan(0.15);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20);
  });
});

describe('hazeParticles', () => {
  it('детерминированы по AQI', () => {
    expect(hazeParticles(160)).toEqual(hazeParticles(160));
    expect(hazeParticles(160)).not.toEqual(hazeParticles(161));
  });

  it('число частиц совпадает с hazeLevel, все внутри viewBox и в нижней части', () => {
    const particles = hazeParticles(220);
    expect(particles).toHaveLength(hazeLevel(220).count);
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(HAZE_BOX.width);
      expect(p.y).toBeGreaterThanOrEqual(PARTICLE_TOP);
      expect(p.y).toBeLessThanOrEqual(HAZE_BOX.height);
      expect(p.r).toBeGreaterThan(0);
      expect(p.opacity).toBeGreaterThan(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
    }
    // Есть и кляксы дымки, и мелкие частицы.
    expect(particles.some((p) => p.blob)).toBe(true);
    expect(particles.some((p) => !p.blob)).toBe(true);
  });

  it('на чистом воздухе пусто', () => {
    expect(hazeParticles(30)).toEqual([]);
    expect(hazeParticles(null)).toEqual([]);
  });
});
