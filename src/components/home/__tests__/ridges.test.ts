/** Процедурный рельеф: детерминизм, границы, форма path, снежная полоса. */

import { describe, expect, it } from 'vitest';

import {
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  ridgeFacets,
  ridgePath,
  ridgeProfile,
  SCENE_BOX,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
} from '../ridges';

describe('ridgeFacets', () => {
  it('грани покрывают хребет от левого до правого края без дыр, чередуя свет и тень', () => {
    for (const spec of [RIDGE_FAR, RIDGE_MID, RIDGE_NEAR]) {
      const facets = ridgeFacets(spec);
      expect(facets.length).toBeGreaterThan(4);
      expect(facets.length).toBeLessThan(80);
      expect(facets[0].d.startsWith('M0 ')).toBe(true);
      expect(facets[facets.length - 1].d).toContain(`L${SCENE_BOX.width} `);
      // Лента глубины: ни одна точка не ниже земли.
      for (const f of facets) {
        for (const m of f.d.matchAll(/[ML]-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)) {
          expect(Number(m[1])).toBeLessThanOrEqual(SCENE_BOX.height);
        }
      }
      // Перегиб меняет направление склона: соседние грани в основном разного
      // тона (слияние узких полос изредка ставит рядом две одинаковые).
      let alternating = 0;
      for (let i = 1; i < facets.length; i += 1) {
        if (facets[i].lit !== facets[i - 1].lit) alternating += 1;
      }
      expect(alternating / (facets.length - 1)).toBeGreaterThan(0.6);
      expect(facets.some((f) => f.lit)).toBe(true);
      expect(facets.some((f) => !f.lit)).toBe(true);
    }
  });

  it('детерминированы', () => {
    expect(ridgeFacets(RIDGE_FAR)).toEqual(ridgeFacets(RIDGE_FAR));
  });
});

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

describe('ridgePath / snowBandPath', () => {
  it('path начинается в x=0, заканчивается на земле и замкнут', () => {
    const d = ridgePath(RIDGE_MID);
    expect(d.startsWith('M0 ')).toBe(true);
    expect(d.endsWith(` L${SCENE_BOX.width} ${SCENE_BOX.height} L0 ${SCENE_BOX.height} Z`)).toBe(
      true,
    );
    // Последняя точка профиля — ровно на правом краю.
    expect(d).toContain(`L${SCENE_BOX.width} `);
  });

  it('снежная полоса идёт от верха viewBox до волнистой линии около SNOW_LINE_Y', () => {
    const d = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);
    expect(d.startsWith(`M0 0 L${SCENE_BOX.width} 0`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const ys = [...d.matchAll(/L\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)]
      .map((m) => Number(m[1]))
      .filter((y) => y !== 0);
    expect(ys.length).toBeGreaterThan(100);
    for (const y of ys) {
      expect(Math.abs(y - SNOW_LINE_Y)).toBeLessThanOrEqual(SNOW_WOBBLE + 0.1);
    }
  });
});
