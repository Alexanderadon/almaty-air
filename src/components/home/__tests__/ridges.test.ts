/** Процедурный рельеф: детерминизм, границы, low-poly-сетка, снежная полоса. */

import { describe, expect, it } from 'vitest';

import {
  FAR_BASE_Y,
  FAR_MESH,
  MID_BASE_Y,
  MID_MESH,
  NEAR_BASE_Y,
  NEAR_MESH,
  profileValue,
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  ridgeMesh,
  ridgeProfile,
  ridgeVertices,
  SCENE_BOX,
  silhouetteAt,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
} from '../ridges';

const RIDGES = [
  { spec: RIDGE_FAR, base: FAR_BASE_Y, options: FAR_MESH },
  { spec: RIDGE_MID, base: MID_BASE_Y, options: MID_MESH },
  { spec: RIDGE_NEAR, base: NEAR_BASE_Y, options: NEAR_MESH },
];

/** Все точки path «M/L x y» → массив {x, y}. */
function points(d: string): { x: number; y: number }[] {
  return [...d.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

describe('ridgeProfile / profileValue', () => {
  it('детерминирован по спецификации, разный сид — разный профиль', () => {
    expect(ridgeProfile(RIDGE_FAR)).toEqual(ridgeProfile(RIDGE_FAR));
    expect(ridgeProfile(RIDGE_FAR)).not.toEqual(ridgeProfile({ ...RIDGE_FAR, seed: 12 }));
  });

  it('точек — width/step + 1, все y внутри viewBox, profileValue совпадает с профилем', () => {
    for (const spec of [RIDGE_FAR, RIDGE_MID, RIDGE_NEAR]) {
      const ys = ridgeProfile(spec);
      expect(ys).toHaveLength(Math.floor(SCENE_BOX.width / spec.step) + 1);
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(4);
        expect(y).toBeLessThanOrEqual(SCENE_BOX.height - 4);
      }
      expect(profileValue(spec, 10 * spec.step)).toBe(ys[10]);
    }
  });

  it('дальний хребет выше среднего, средний выше ближнего (в среднем)', () => {
    const mean = (ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;
    expect(mean(ridgeProfile(RIDGE_FAR))).toBeLessThan(mean(ridgeProfile(RIDGE_MID)));
    expect(mean(ridgeProfile(RIDGE_MID))).toBeLessThan(mean(ridgeProfile(RIDGE_NEAR)));
  });

  it('главный массив дальнего хребта поднимается выше линии снега — снежники есть', () => {
    const ys = ridgeProfile(RIDGE_FAR);
    expect(Math.min(...ys)).toBeLessThan(SNOW_LINE_Y - SNOW_WOBBLE);
  });
});

describe('ridgeVertices / silhouetteAt', () => {
  it('от левого до правого края, x строго растёт, вершины выше базовой линии', () => {
    for (const { spec, base, options } of RIDGES) {
      const v = ridgeVertices(spec, SCENE_BOX, options.minWidth);
      expect(v.length).toBeGreaterThan(8);
      expect(v.length).toBeLessThan(80);
      expect(v[0].x).toBe(0);
      expect(v[v.length - 1].x).toBe(SCENE_BOX.width);
      for (let i = 1; i < v.length; i += 1) expect(v[i].x).toBeGreaterThan(v[i - 1].x);
      for (const p of v) expect(p.y).toBeLessThan(base);
    }
  });

  it('дальний хребет дробнее ближнего', () => {
    expect(ridgeVertices(RIDGE_FAR, SCENE_BOX, FAR_MESH.minWidth).length).toBeGreaterThan(
      ridgeVertices(RIDGE_NEAR, SCENE_BOX, NEAR_MESH.minWidth).length,
    );
  });

  it('silhouetteAt: в вершинах — точное значение, между — линейная интерполяция, за краями — края', () => {
    const v = [
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 150 },
    ];
    expect(silhouetteAt(v, 100)).toBe(50);
    expect(silhouetteAt(v, 50)).toBe(75);
    expect(silhouetteAt(v, 150)).toBe(100);
    expect(silhouetteAt(v, -10)).toBe(100);
    expect(silhouetteAt(v, 999)).toBe(150);
    expect(silhouetteAt([], 5)).toBe(0);
  });
});

describe('ridgeMesh', () => {
  it('n−1 гребневых треугольников со светом и тенью, встречные — mid или расколотые на три', () => {
    for (const { spec, base, options } of RIDGES) {
      const n = ridgeVertices(spec, SCENE_BOX, options.minWidth).length;
      const mesh = ridgeMesh(spec, base, SCENE_BOX, options);
      const crest = mesh.triangles.filter((t) => t.crest);
      const valley = mesh.triangles.filter((t) => !t.crest);
      expect(crest).toHaveLength(n - 1);
      expect(valley.length).toBeGreaterThanOrEqual(n);
      expect(valley.length).toBeLessThanOrEqual(3 * n);
      expect(crest.some((t) => t.tone === 'lit')).toBe(true);
      expect(crest.some((t) => t.tone === 'shade')).toBe(true);
      expect(mesh.vertices).toHaveLength(n);
      expect(mesh.baseY).toBe(base);
      expect(mesh.outline.startsWith('M0 ')).toBe(true);
      expect(mesh.baseOutline.startsWith(`M0 ${base}`)).toBe(true);
      expect(mesh.baseOutline.endsWith(`L${SCENE_BOX.width} ${SCENE_BOX.height} L0 ${SCENE_BOX.height} Z`)).toBe(
        true,
      );
    }
  });

  it('базовые точки поднимаются не выше jitter и остаются под вершинами силуэта', () => {
    const mesh = ridgeMesh(RIDGE_FAR, FAR_BASE_Y, SCENE_BOX, FAR_MESH);
    const bases = points(mesh.baseOutline).slice(0, -2);
    expect(bases.length).toBe(mesh.vertices.length + 1);
    for (let i = 0; i < bases.length; i += 1) {
      expect(bases[i].y).toBeLessThanOrEqual(FAR_BASE_Y);
      expect(bases[i].y).toBeGreaterThanOrEqual(FAR_BASE_Y - (FAR_MESH.jitter ?? 0) - 0.1);
    }
    for (let i = 1; i < bases.length - 1; i += 1) {
      const above = Math.max(mesh.vertices[i - 1].y, mesh.vertices[i].y);
      expect(bases[i].y).toBeGreaterThan(above);
    }
    // Без jitter — все базовые точки ровно на baseY.
    const flat = ridgeMesh(RIDGE_NEAR, NEAR_BASE_Y, SCENE_BOX, NEAR_MESH);
    for (const p of points(flat.baseOutline).slice(0, -2)) expect(p.y).toBe(NEAR_BASE_Y);
  });

  it('свет — на склонах, спускающихся вправо (светило справа)', () => {
    const mesh = ridgeMesh(RIDGE_FAR, FAR_BASE_Y, SCENE_BOX, FAR_MESH);
    const v = mesh.vertices;
    const crest = mesh.triangles.filter((t) => t.crest);
    for (let i = 0; i < crest.length; i += 1) {
      expect(crest[i].tone).toBe(v[i + 1].y > v[i].y ? 'lit' : 'shade');
    }
  });

  it('раскол: широкие встречные треугольники дают три тона, узкие — один', () => {
    const split = ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, { ...MID_MESH, splitWidth: 10 });
    const whole = ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, { ...MID_MESH, splitWidth: Infinity });
    const n = split.vertices.length;
    expect(split.triangles.filter((t) => !t.crest)).toHaveLength(3 * n);
    expect(whole.triangles.filter((t) => !t.crest)).toHaveLength(n);
    expect(whole.triangles.filter((t) => !t.crest).every((t) => t.tone === 'mid')).toBe(true);
  });

  it('детерминирована', () => {
    expect(ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, MID_MESH)).toEqual(
      ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, MID_MESH),
    );
  });
});

describe('snowBandPath', () => {
  it('идёт от верха viewBox до ломаной около SNOW_LINE_Y', () => {
    const d = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);
    expect(d.startsWith(`M0 0 L${SCENE_BOX.width} 0`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const ys = points(d)
      .map((p) => p.y)
      .filter((y) => y !== 0);
    expect(ys.length).toBeGreaterThan(20);
    for (const y of ys) {
      expect(Math.abs(y - SNOW_LINE_Y)).toBeLessThanOrEqual(SNOW_WOBBLE + 0.1);
    }
  });
});
