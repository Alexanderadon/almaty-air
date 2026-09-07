/**
 * Ночная low-poly-сцена для OG-карточек — та же геометрия, что в герое
 * главной (components/home/sceneGeometry), но с фиксированными цветами и
 * как готовая SVG-строка: satori не выполняет React-компоненты внутри
 * вложенного <svg>, зато уверенно растрирует <img src="data:image/svg+xml">.
 *
 * Смог по AQI: слой тумана над ближним гребнем плотнеет с ростом индекса
 * (haze.ts) — превью ссылки показывает состояние воздуха буквально.
 */

import { hazeLevel } from '@/components/home/haze';
import { type RidgeMesh, SCENE_BOX, type Tone } from '@/components/home/ridges';
import {
  CITY_LIGHTS,
  FAR,
  FOG_ELLIPSES,
  LUMINARY,
  MID,
  NEAR,
  SKY_BANDS,
  SNOW,
  SPRUCES,
  STARS,
  TOWER_BASE,
  TOWER_H,
  TOWER_X,
} from '@/components/home/sceneGeometry';

/** Ночная палитра сцены (зеркало --dark-* из globals.css). */
export const OG_SCENE_COLORS = {
  sky: '#101216',
  skyglow: '#7E8AA6',
  star: '#C7CDD8',
  moon: '#DCE1EA',
  far: { lit: '#4F5A78', mid: '#444E68', shade: '#384158' },
  mid: { lit: '#363F58', mid: '#2E364C', shade: '#252C40' },
  near: { lit: '#232A3C', mid: '#1E2434', shade: '#181D2A' },
  snowLit: '#E3E8F2',
  snowShade: '#A9B3C9',
  mist: '#8C97AD',
  smog: '#8A8376',
  spruce: '#0E121A',
  towerLight: '#FF5A45',
  cityLight: '#F2C98A',
} as const;

function ridge(mesh: RidgeMesh, tones: Record<Tone, string>): string {
  const body = `<path d="${mesh.baseOutline}" fill="${tones.shade}"/>`;
  const tris = mesh.triangles
    .map((t) => `<path d="${t.d}" fill="${tones[t.tone]}" stroke="${tones[t.tone]}" stroke-width="0.8"/>`)
    .join('');
  return body + tris;
}

/** Полоса тумана в координатах сцены: эллипсы FOG_ELLIPSES растянуты в прямоугольник [y0, y0+h]. */
function fog(y0: number, h: number, color: string, opacity: number): string {
  const sy = h / 80;
  const ellipses = FOG_ELLIPSES.map(
    (e) => `<ellipse cx="${e.cx}" cy="${(y0 + e.cy * sy).toFixed(1)}" rx="${e.rx}" ry="${(e.ry * sy).toFixed(1)}"/>`,
  ).join('');
  return `<g fill="${color}" opacity="${opacity}">${ellipses}</g>`;
}

/** SVG-разметка сцены заданного размера (в px), обрезка как в герое: xMidYMax slice. */
export function ogSceneSvg(width: number, height: number, aqi: number | null): string {
  const c = OG_SCENE_COLORS;
  const { width: W, height: H } = SCENE_BOX;
  const haze = hazeLevel(aqi).fog;
  const clip = (id: string, tris: typeof FAR.triangles) =>
    `<clipPath id="${id}">${tris.map((t) => `<path d="${t.d}"/>`).join('')}</clipPath>`;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">`,
    `<defs>${clip('og-far-lit', FAR.triangles.filter((t) => t.tone === 'lit'))}${clip('og-far-shade', FAR.triangles.filter((t) => t.tone !== 'lit'))}</defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${c.sky}"/>`,
    ...SKY_BANDS.map((b) => `<rect x="0" y="${b.y}" width="${W}" height="${b.h}" fill="${c.skyglow}" opacity="${b.opacity}"/>`),
    ...STARS.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${c.star}" opacity="${s.opacity}"/>`),
    `<circle cx="${LUMINARY.cx}" cy="${LUMINARY.cy}" r="${LUMINARY.r + 20}" fill="${c.moon}" opacity="0.05"/>`,
    `<circle cx="${LUMINARY.cx}" cy="${LUMINARY.cy}" r="${LUMINARY.r + 9}" fill="${c.moon}" opacity="0.07"/>`,
    `<circle cx="${LUMINARY.cx}" cy="${LUMINARY.cy}" r="${LUMINARY.r}" fill="${c.moon}"/>`,
    `<circle cx="${LUMINARY.cx + 6}" cy="${LUMINARY.cy - 4}" r="${LUMINARY.r - 2}" fill="${c.sky}"/>`,
    ridge(FAR, c.far),
    `<path d="${SNOW}" fill="${c.snowShade}" clip-path="url(#og-far-shade)"/>`,
    `<path d="${SNOW}" fill="${c.snowLit}" clip-path="url(#og-far-lit)"/>`,
    ridge(MID, c.mid),
    fog(H * 0.58, H * 0.3, c.mist, 0.22),
    haze > 0 ? fog(H * 0.46, H * 0.38, c.smog, haze) : '',
    ridge(NEAR, c.near),
    `<g fill="${c.spruce}">${SPRUCES.map((d) => `<path d="${d}"/>`).join('')}`,
    `<rect x="${TOWER_X - 1.6}" y="${(TOWER_BASE - TOWER_H).toFixed(1)}" width="3.2" height="${TOWER_H}"/>`,
    `<rect x="${TOWER_X - 6}" y="${(TOWER_BASE - TOWER_H * 0.62).toFixed(1)}" width="12" height="6"/>`,
    `<rect x="${TOWER_X - 4}" y="${(TOWER_BASE - TOWER_H * 0.44).toFixed(1)}" width="8" height="4"/>`,
    `<path d="M${TOWER_X - 9} ${TOWER_BASE.toFixed(1)} L${TOWER_X - 1.6} ${(TOWER_BASE - 18).toFixed(1)} L${TOWER_X + 1.6} ${(TOWER_BASE - 18).toFixed(1)} L${TOWER_X + 9} ${TOWER_BASE.toFixed(1)} Z"/></g>`,
    `<circle cx="${TOWER_X}" cy="${(TOWER_BASE - TOWER_H - 1.5).toFixed(1)}" r="2.2" fill="${c.towerLight}"/>`,
    ...CITY_LIGHTS.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="${c.cityLight}" opacity="${l.opacity}"/>`),
    haze > 0 ? fog(H * 0.72, H * 0.28, c.smog, Math.round(haze * 85) / 100) : '',
    '</svg>',
  ];
  return parts.join('');
}

/** data-URI для <img> в satori. */
export function ogSceneDataUri(width: number, height: number, aqi: number | null): string {
  return `data:image/svg+xml;base64,${Buffer.from(ogSceneSvg(width, height, aqi), 'utf8').toString('base64')}`;
}
