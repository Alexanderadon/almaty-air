/** Процедурный рельеф: детерминизм, границы, low-poly-сетка, снежная полоса. */

import { describe, expect, it } from 'vitest';

import {
  FAR_BASE_Y,
  FAR_FACET_WIDTH,
  MID_BASE_Y,
  MID_FACET_WIDTH,
  NEAR_BASE_Y,
  NEAR_FACET_WIDTH,
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  ridgeMesh,
  ridgeProfile,
  ridgeVertices,
  SCENE_BOX,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
} from '../ridges';

const RIDGES = [
  { spec: RIDGE_FAR, base: FAR_BASE_Y, width: FAR_FACET_WIDTH },
  { spec: RIDGE_MID, base: MID_BASE_Y, width: MID_FACET_WIDTH },
  { spec: RIDGE_NEAR, base: NEAR_BASE_Y, width: NEAR_FACET_WIDTH },
];

describe('ridgeProfile', () => {
  it('детерминирован по спецификации, разный сид — разный профиль', () => {
    expect(ridgeProfile(RIDGE_FAR)).toEqual(ridgeProfile(RIDGE_FAR));
    expect(ridgeProfile(RIDGE_FAR)).not.toEqual(ridgeProfile({ ...RIDGE_FAR, seed: 12 }));
  });

  it('точек — width/step + 1, все y внутри viewBox', () => {
    for (const spec of [RIDGE_FAR, RIDGE_MID, RIDGE_NEAR]) {
      const ys = ridgeProfile(spec);
      expect(ys).toHaveLength(Math.floor(SCENE_BOX.width / spec.step) + 1);
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(4);
        expect(y).toBeLessThanOrEqual(SCENE_BOX.height - 4);
      }
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

describe('ridgeVertices', () => {
  it('от левого до правого края, x строго растёт, вершины выше базовой линии', () => {
    for (const { spec, base, width } of RIDGES) {
      const v = ridgeVertices(spec, SCENE_BOX, width);
      expect(v.length).toBeGreaterThan(8);
      expect(v.length).toBeLessThan(80);
      expect(v[0].x).toBe(0);
      expect(v[v.length - 1].x).toBe(SCENE_BOX.width);
      for (let i = 1; i < v.length; i += 1) expect(v[i].x).toBeGreaterThan(v[i - 1].x);
      for (const p of v) expect(p.y).toBeLessThan(base);
    }
  });

  it('дальний хребет дробнее ближнего', () => {
    expect(ridgeVertices(RIDGE_FAR, SCENE_BOX, FAR_FACET_WIDTH).length).toBeGreaterThan(
      ridgeVertices(RIDGE_NEAR, SCENE_BOX, NEAR_FACET_WIDTH).length,
    );
  });
});

describe('ridgeMesh', () => {
  it('2n−1 треугольников: n встречных у базы и n−1 под отрезками гребня; есть свет и тень', () => {
    for (const { spec, base, width } of RIDGES) {
      const n = ridgeVertices(spec, SCENE_BOX, width).length;
      const mesh = ridgeMesh(spec, base, SCENE_BOX, width);
      expect(mesh.triangles).toHaveLength(2 * n - 1);
      expect(mesh.triangles.filter((t) => !t.crest)).toHaveLength(n);
      expect(mesh.triangles.filter((t) => t.crest && t.tone === 'lit').length).toBeGreaterThan(0);
      expect(mesh.triangles.filter((t) => t.crest && t.tone === 'shade').length).toBeGreaterThan(
        0,
      );
      expect(mesh.triangles.filter((t) => !t.crest).every((t) => t.tone === 'mid')).toBe(true);
      expect(mesh.baseY).toBe(base);
      expect(mesh.outline.startsWith('M0 ')).toBe(true);
      expect(mesh.outline.endsWith(` L${SCENE_BOX.width} ${SCENE_BOX.height} L0 ${SCENE_BOX.height} Z`)).toBe(
        true,
      );
    }
  });

  it('свет — на склонах, спускающихся вправо (светило справа)', () => {
    const v = ridgeVertices(RIDGE_FAR, SCENE_BOX, FAR_FACET_WIDTH);
    const crest = ridgeMesh(RIDGE_FAR, FAR_BASE_Y, SCENE_BOX, FAR_FACET_WIDTH).triangles.filter(
      (t) => t.crest,
    );
    for (let i = 0; i < crest.length; i += 1) {
      expect(crest[i].tone).toBe(v[i + 1].y > v[i].y ? 'lit' : 'shade');
    }
  });

  it('детерминирована', () => {
    expect(ridgeMesh(RIDGE_MID, MID_BASE_Y)).toEqual(ridgeMesh(RIDGE_MID, MID_BASE_Y));
  });
});

describe('snowBandPath', () => {
  it('идёт от верха viewBox до ломаной около SNOW_LINE_Y', () => {
    const d = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);
    expect(d.startsWith(`M0 0 L${SCENE_BOX.width} 0`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const ys = [...d.matchAll(/L\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)]
      .map((m) => Number(m[1]))
      .filter((y) => y !== 0);
    expect(ys.length).toBeGreaterThan(20);
    for (const y of ys) {
      expect(Math.abs(y - SNOW_LINE_Y)).toBeLessThanOrEqual(SNOW_WOBBLE + 0.1);
    }
  });
});
