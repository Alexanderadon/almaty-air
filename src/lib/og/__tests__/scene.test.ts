/** SVG-сцена OG-карточки: валидная разметка, все слои на месте, смог по AQI. */

import { describe, expect, it } from 'vitest';

import { CITY_LIGHTS, SPRUCES, STARS } from '../../../components/home/sceneGeometry';
import { OG_SCENE_COLORS, ogSceneDataUri, ogSceneSvg } from '../scene';

describe('ogSceneSvg', () => {
  it('корневой svg с размерами, viewBox и обрезкой как в герое', () => {
    const svg = ogSceneSvg(1200, 300, 40);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 1440 260"');
    expect(svg).toContain('preserveAspectRatio="xMidYMax slice"');
    expect(svg.endsWith('</svg>')).toBe(true);
    // Теги сбалансированы (грубая проверка на битую разметку).
    expect((svg.match(/<g\b/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
    expect((svg.match(/<clipPath\b/g) ?? []).length).toBe(2);
  });

  it('содержит звёзды, огни города, ели, башню, луну и снег', () => {
    const svg = ogSceneSvg(1200, 300, 40);
    expect((svg.match(new RegExp(`fill="${OG_SCENE_COLORS.star}"`, 'g')) ?? []).length).toBe(STARS.length);
    expect((svg.match(new RegExp(`fill="${OG_SCENE_COLORS.cityLight}"`, 'g')) ?? []).length).toBe(
      CITY_LIGHTS.length,
    );
    expect((svg.match(/<path d="M[^"]*"\/>/g) ?? []).length).toBeGreaterThanOrEqual(SPRUCES.length);
    expect(svg).toContain(`fill="${OG_SCENE_COLORS.towerLight}"`);
    expect(svg).toContain(`fill="${OG_SCENE_COLORS.moon}"`);
    expect(svg).toContain('clip-path="url(#og-far-lit)"');
    expect(svg).toContain('clip-path="url(#og-far-shade)"');
  });

  it('смог появляется только при грязном воздухе и плотнеет с AQI', () => {
    const clean = ogSceneSvg(1200, 300, 30);
    const dirty = ogSceneSvg(1200, 300, 180);
    const worse = ogSceneSvg(1200, 300, 300);
    const smog = (s: string) => (s.match(new RegExp(`fill="${OG_SCENE_COLORS.smog}"`, 'g')) ?? []).length;
    expect(smog(clean)).toBe(0);
    expect(smog(dirty)).toBe(2);
    const opacity = (s: string) => Number(s.match(new RegExp(`fill="${OG_SCENE_COLORS.smog}" opacity="([\\d.]+)"`))?.[1]);
    expect(opacity(worse)).toBeGreaterThan(opacity(dirty));
    // Без данных — как чистый воздух: смога нет.
    expect(ogSceneSvg(1200, 300, null)).toBe(clean);
  });

  it('data-URI — base64 того же SVG', () => {
    const uri = ogSceneDataUri(600, 150, 70);
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = Buffer.from(uri.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');
    expect(decoded).toBe(ogSceneSvg(600, 150, 70));
  });
});
