/**
 * Геометрия сцены Заилийского Алатау, общая для героя главной (HeroScene)
 * и OG-карточек (lib/og/scene): сетки гребней, снег, звёзды, огни города,
 * ели, телебашня, светило и полосы засветки неба. Всё детерминировано и
 * считается один раз на модуль. Без React и DOM.
 */

import {
  FAR_BASE_Y,
  FAR_MESH,
  MID_BASE_Y,
  MID_MESH,
  NEAR_BASE_Y,
  NEAR_MESH,
  NEAR_VERTICES,
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  ridgeMesh,
  SCENE_BOX,
  silhouetteAt,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
} from './ridges';

/* Сетки гребней и снег. */
export const FAR = ridgeMesh(RIDGE_FAR, FAR_BASE_Y, SCENE_BOX, FAR_MESH);
export const MID = ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, MID_MESH);
export const NEAR = ridgeMesh(RIDGE_NEAR, NEAR_BASE_Y, SCENE_BOX, NEAR_MESH);
export const SNOW = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);

/** Светило: справа от главного массива, над гребнями — свет на гранях идёт оттуда же. */
export const LUMINARY = { cx: 1010, cy: 64, r: 15 } as const;

/**
 * Засветка неба у горизонта: пять плоских полос нарастающей непрозрачности
 * от y = 58 до линии хребта. Ступени вместо градиента — намеренно, в тон
 * low-poly-сцене; нижние полосы почти целиком прячутся за гребнями.
 */
export const SKY_BANDS = [0.035, 0.06, 0.09, 0.125, 0.16].map((opacity, i) => ({
  y: 58 + i * 19,
  h: 19 + (i === 4 ? 60 : 0),
  opacity,
}));

/** Целочисленный хэш → [0, 1): позиции звёзд, огней и капель без решётки и диагональных «строчек». */
export function hash01(seed: number, i: number): number {
  let h = (Math.imul(seed, 374761393) + Math.imul(i, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Звёзды ясной ночи: в полосе между зоной текста героя (верхние ~50 единиц
 * сцены на десктопе) и линией хребта; статичные — никакого мерцания.
 */
export const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: r1(hash01(7, i * 3) * SCENE_BOX.width),
  y: r1(54 + hash01(7, i * 3 + 1) * 56),
  r: r1(0.6 + hash01(7, i * 3 + 2) * 0.8),
  opacity: Math.round((0.35 + hash01(9, i) * 0.5) * 100) / 100,
}));

/**
 * Огни города у подножия: Алматы лежит под хребтом, к зрителю. Точки в
 * нижней полосе сцены, гуще к центру; несколько крупных — проспекты.
 * Рисуются под слоями смога, поэтому в грязный воздух тускнеют и тонут.
 */
export const CITY_LIGHTS = Array.from({ length: 84 }, (_, i) => {
  const spread = 0.55 + 0.45 * hash01(13, i * 4 + 3);
  const big = i % 14 === 0;
  return {
    x: r1(SCENE_BOX.width * (0.5 + (hash01(13, i * 4) - 0.5) * spread)),
    y: r1(NEAR_BASE_Y - 30 + hash01(13, i * 4 + 1) * 26),
    r: r1(big ? 1.9 + hash01(13, i * 4 + 2) : 0.7 + hash01(13, i * 4 + 2) * 0.9),
    opacity: Math.round((big ? 0.9 : 0.45 + hash01(15, i) * 0.5) * 100) / 100,
  };
});

/**
 * Тянь-шаньские ели на ближнем склоне: стоят точно на low-poly-силуэте,
 * группами внутри зоны, видимой и на телефоне (x ≈ 382…1058); центр
 * оставлен массиву. Силуэт из трёх ярусов.
 */
export function spruce(x: number, base: number, h: number): string {
  const w = h * 0.34;
  const p = (dx: number, dy: number) => `${r1(x + dx)} ${r1(base - dy)}`;
  return (
    `M${p(0, h)} L${p(w * 0.55, h * 0.64)} L${p(w * 0.3, h * 0.64)} L${p(w * 0.82, h * 0.34)} ` +
    `L${p(w * 0.5, h * 0.34)} L${p(w, 0)} L${p(-w, 0)} L${p(-w * 0.5, h * 0.34)} ` +
    `L${p(-w * 0.82, h * 0.34)} L${p(-w * 0.3, h * 0.64)} L${p(-w * 0.55, h * 0.64)} Z`
  );
}

const SPRUCE_ZONES: readonly [number, number][] = [
  [390, 560],
  [860, 1050],
];

export const SPRUCES = SPRUCE_ZONES.flatMap(([from, to], z) =>
  Array.from({ length: 12 }, (_, i) => {
    const x = from + (to - from) * hash01(21 + z, i * 2);
    const h = 13 + 17 * hash01(21 + z, i * 2 + 1);
    return spruce(x, silhouetteAt(NEAR_VERTICES, x) + 1.5, h);
  }),
);

/** Телебашня на Кок-Тобе под луной — самый узнаваемый силуэт над городом; стоит на ближнем гребне. */
export const TOWER_X = 985;
export const TOWER_BASE = silhouetteAt(NEAR_VERTICES, TOWER_X) + 1;
export const TOWER_H = 68;

/** Полоса дымки/тумана: четыре широких эллипса на всю ширину слоя (viewBox 1440×80). */
export const FOG_ELLIPSES = [
  { cx: 220, cy: 50, rx: 430, ry: 28 },
  { cx: 720, cy: 44, rx: 540, ry: 34 },
  { cx: 1240, cy: 52, rx: 420, ry: 26 },
  { cx: 470, cy: 64, rx: 380, ry: 18 },
] as const;
