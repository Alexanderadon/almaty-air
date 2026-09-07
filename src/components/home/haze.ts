/**
 * Чистая математика смога в герое: AQI → плотность тумана и набор частиц.
 * Вынесена из HeroSkyline.tsx, чтобы покрыть тестами (vitest, node):
 * монотонность «грязнее — плотнее», нули на чистом воздухе, детерминизм.
 */

/** Габариты viewBox силуэта — в них же считаются координаты частиц. */
export const HAZE_BOX = { width: 1440, height: 220 } as const;

/** До этого AQI воздух считаем визуально чистым: ни тумана, ни частиц. */
const CLEAN_AQI = 40;
/** С этого AQI смог максимальный — плотнее уже не рисуем. */
const WORST_AQI = 300;
const MAX_PARTICLES = 90;
const MAX_FOG = 0.78;
/** Выше этой линии viewBox (над гребнями) частиц нет — смог лежит на земле, а не в небе. */
export const PARTICLE_TOP = 100;

export interface HazeLevel {
  /** Непрозрачность слоя тумана, 0…MAX_FOG. */
  fog: number;
  /** Число частиц, 0…MAX_PARTICLES. */
  count: number;
}

export interface HazeParticle {
  x: number;
  y: number;
  r: number;
  opacity: number;
  /** Крупная полупрозрачная «клякса» дымки, а не точка-частица. */
  blob: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Доля «грязности» 0…1 по AQI: ниже CLEAN_AQI — 0, выше WORST_AQI — 1. */
export function hazeRatio(aqi: number | null): number {
  if (aqi === null || !Number.isFinite(aqi)) return 0;
  return clamp01((aqi - CLEAN_AQI) / (WORST_AQI - CLEAN_AQI));
}

export function hazeLevel(aqi: number | null): HazeLevel {
  const t = hazeRatio(aqi);
  return { fog: round2(t * MAX_FOG), count: Math.round(t * MAX_PARTICLES) };
}

/** mulberry32 — крошечный детерминированный PRNG: одинаковый AQI → одинаковая картинка. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Частицы смога для текущего AQI. Сидируются округлённым AQI, поэтому
 * серверный рендер воспроизводим. Скапливаются внизу (инверсия держит
 * смог у земли): y смещён к основанию степенной функцией и не поднимается
 * выше PARTICLE_TOP. Каждая третья — крупная блёклая клякса дымки,
 * остальные — мелкие точки.
 */
export function hazeParticles(aqi: number | null): HazeParticle[] {
  const { count } = hazeLevel(aqi);
  if (count === 0 || aqi === null) return [];
  const rnd = mulberry32(Math.round(aqi) * 7919 + 17);
  const { width, height } = HAZE_BOX;
  const particles: HazeParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const blob = i % 3 === 2;
    const x = round2(rnd() * width);
    const y = round2(PARTICLE_TOP + (height - 6 - PARTICLE_TOP) * Math.pow(rnd(), 0.45));
    particles.push(
      blob
        ? { x, y, r: round2(7 + rnd() * 8), opacity: round2(0.05 + rnd() * 0.06), blob }
        : { x, y, r: round2(1 + rnd() * 1.8), opacity: round2(0.25 + rnd() * 0.3), blob },
    );
  }
  return particles;
}
