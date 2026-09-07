import type { CSSProperties } from 'react';
import type { CurrentWeather } from '@/lib/sources/weather';
import { describeWeatherCode, sceneFor } from '@/lib/weather-codes';
import { HAZE_BOX, hazeLevel, hazeParticles } from './haze';
import {
  type Facet,
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  ridgeFacets,
  ridgePath,
  SCENE_BOX,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
} from './ridges';
import { SceneMotion } from './SceneMotion';

export interface HeroSceneProps {
  /** AQI по городу — плотность смога; null — чистые горы. */
  aqi: number | null;
  /** Текущая погода — облака и осадки; null — одно облако, без осадков. */
  weather: CurrentWeather | null;
}

/* Тела гребней, грани и снег считаются один раз на модуль: сцена детерминирована. */
const FAR_BODY = ridgePath(RIDGE_FAR);
const MID_BODY = ridgePath(RIDGE_MID);
const NEAR_BODY = ridgePath(RIDGE_NEAR);
const FAR = ridgeFacets(RIDGE_FAR, SCENE_BOX, 28, 72);
const MID = ridgeFacets(RIDGE_MID, SCENE_BOX, 28, 40);
const NEAR = ridgeFacets(RIDGE_NEAR, SCENE_BOX, 28, 26);
const SNOW = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);

/** Облака: ширина (% героя), высота положения (% сцены), период и сдвиг фазы. */
const CLOUDS = [
  { width: 26, top: 2, duration: 150, delay: -40, rest: 180, scale: 1 },
  { width: 19, top: 14, duration: 110, delay: -85, rest: 330, scale: 0.8 },
  { width: 32, top: 6, duration: 190, delay: -130, rest: 450, scale: 1.1 },
] as const;

/** Светило: справа от главного массива, над гребнями — свет на гранях идёт оттуда же. */
const LUMINARY = { cx: 1010, cy: 64, r: 15 };

/** Целочисленный хэш → [0, 1): позиции звёзд и капель без решётки и диагональных «строчек». */
function hash01(seed: number, i: number): number {
  let h = (Math.imul(seed, 374761393) + Math.imul(i, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Звёзды ясной ночи: в полосе между зоной текста героя (верхние ~50 единиц
 * сцены на десктопе) и линией хребта; статичные — никакого мерцания.
 */
const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: Math.round(hash01(7, i * 3) * SCENE_BOX.width * 10) / 10,
  y: Math.round((54 + hash01(7, i * 3 + 1) * 56) * 10) / 10,
  r: Math.round((0.6 + hash01(7, i * 3 + 2) * 0.8) * 10) / 10,
  opacity: Math.round((0.35 + hash01(9, i) * 0.5) * 100) / 100,
}));

/** Дождь/снег: детерминированный набор капель (x в % ширины, y в % половины слоя, d — «глубина» 0…2). */
function precipitation(count: number, seed: number): { x: number; y: number; d: number }[] {
  const out: { x: number; y: number; d: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      x: Math.round(hash01(seed, i * 2) * 1000) / 10,
      y: Math.round(hash01(seed, i * 2 + 1) * 500) / 10,
      d: i % 3,
    });
  }
  return out;
}

function Cloud() {
  return (
    <svg viewBox="0 0 200 70" className="block w-full" aria-hidden="true" focusable="false">
      <g fill="var(--cloud)">
        <ellipse cx="62" cy="44" rx="58" ry="20" />
        <ellipse cx="108" cy="34" rx="44" ry="26" />
        <ellipse cx="150" cy="46" rx="48" ry="18" />
        <ellipse cx="32" cy="50" rx="30" ry="13" />
      </g>
    </svg>
  );
}

/** Полоса дымки/тумана: четыре широких эллипса, растягиваются на всю ширину слоя. */
function FogBank({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <g fill={color} opacity="0.5">
        <ellipse cx="220" cy="50" rx="430" ry="28" />
        <ellipse cx="720" cy="44" rx="540" ry="34" />
        <ellipse cx="1240" cy="52" rx="420" ry="26" />
        <ellipse cx="470" cy="64" rx="380" ry="18" />
      </g>
    </svg>
  );
}

/** Гребень: тело теневым тоном, поверх — освещённые ленты граней вдоль линии хребта. */
function Ridge({
  body,
  facets,
  lit,
  shade,
}: {
  body: string;
  facets: Facet[];
  lit: string;
  shade: string;
}) {
  return (
    <>
      <path d={body} fill={shade} />
      {facets.filter((f) => f.lit).map((f) => (
        <path key={f.d} d={f.d} fill={lit} />
      ))}
    </>
  );
}

function RidgeSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * Сцена в герое главной: небо (звёзды и луна ночью, солнце днём), облака,
 * три гребня Заилийского Алатау в фасетной подсветке (свет справа, где
 * светило) со снежниками в два тона, дымка между гребнями, смог по AQI
 * (туман и частицы) и осадки по погоде.
 *
 * Движение — только transform на отдельных слоях-div с will-change
 * (композитор, без перерисовок): облака плывут, дымка «дышит», частицы
 * дрейфуют, дождь и снег падают. rAF и canvas не используются. Вне
 * экрана слои на паузе (SceneMotion), при prefers-reduced-motion —
 * статичный кадр с облаками на «позициях покоя».
 *
 * Слой позиционируется absolute к низу героя (relative + isolate +
 * overflow-hidden), -z-10 уводит его под текст.
 */
export function HeroScene({ aqi, weather }: HeroSceneProps) {
  const haze = hazeLevel(aqi);
  const particles = hazeParticles(aqi);
  const kind = weather !== null ? describeWeatherCode(weather.weatherCode).kind : 'clear';
  const scene = sceneFor(kind);
  const isDay = weather?.isDay ?? true;
  const clearSky = kind === 'clear' || kind === 'partly';
  const cloudOpacity = Math.round(scene.cloudOpacity * (isDay ? 1 : 0.8) * 100) / 100;
  const fog = Math.min(0.9, Math.round((haze.fog + scene.fogBoost) * 100) / 100);
  const rain = precipitation(scene.rainDrops, 1);
  const snow = precipitation(scene.snowFlakes, 2);

  // Частицы — два слоя с разной скоростью (параллакс); координаты в % сцены.
  // Слой шириной 200% с дублем содержимого во второй половине — сдвиг на
  // −50% замыкается без шва.
  const layers = [particles.filter((_, i) => i % 2 === 0), particles.filter((_, i) => i % 2 === 1)];

  return (
    <div
      data-hero-scene=""
      aria-hidden="true"
      className="hero-scene pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[170px] overflow-hidden sm:h-[260px]"
    >
      <SceneMotion />

      {/* Небо: звёзды и луна ясной ночью (звёзды в светлой теме прозрачны), солнце днём. */}
      <RidgeSvg>
        {!isDay &&
          clearSky &&
          STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--star)" opacity={s.opacity} />
          ))}
        {clearSky &&
          (isDay ? (
            <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 1} fill="var(--sun)" />
          ) : (
            <>
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r} fill="var(--moon)" />
              <circle cx={LUMINARY.cx + 6} cy={LUMINARY.cy - 4} r={LUMINARY.r - 2} fill="var(--surface)" />
            </>
          ))}
      </RidgeSvg>

      {CLOUDS.slice(0, scene.clouds).map((c, i) => (
        <div
          key={i}
          className="scene-cloud absolute"
          style={
            {
              width: `${c.width}%`,
              top: `${c.top}%`,
              left: `-${c.width}%`,
              opacity: cloudOpacity,
              '--dur': `${c.duration}s`,
              '--delay': `${c.delay}s`,
              '--rest': `${c.rest}%`,
              '--scale': c.scale,
            } as CSSProperties
          }
        >
          <Cloud />
        </div>
      ))}

      {/* Дальний хребет со снегом и средний гребень */}
      <RidgeSvg>
        <defs>
          <clipPath id="hero-far-lit">
            {FAR.filter((f) => f.lit).map((f) => (
              <path key={f.d} d={f.d} />
            ))}
          </clipPath>
          <clipPath id="hero-far-shade">
            {FAR.filter((f) => !f.lit).map((f) => (
              <path key={f.d} d={f.d} />
            ))}
          </clipPath>
        </defs>
        <Ridge
          body={FAR_BODY}
          facets={FAR}
          lit="var(--ridge-far-lit)"
          shade="var(--ridge-far-shade)"
        />
        <path d={SNOW} fill="var(--snow-shade)" clipPath="url(#hero-far-shade)" />
        <path d={SNOW} fill="var(--snow-lit)" clipPath="url(#hero-far-lit)" />
        <Ridge
          body={MID_BODY}
          facets={MID}
          lit="var(--ridge-mid-lit)"
          shade="var(--ridge-mid-shade)"
        />
      </RidgeSvg>

      {/* Постоянная дымка между средним и ближним гребнями — воздушная перспектива */}
      <div
        className="scene-fog absolute left-[-6%] w-[112%]"
        style={{ bottom: '12%', height: '30%', opacity: 0.22, '--dur': '64s' } as CSSProperties}
      >
        <FogBank color="var(--mist)" />
      </div>

      {fog > 0 && (
        <div
          className="scene-fog absolute left-[-6%] w-[112%]"
          style={{ bottom: '16%', height: '38%', opacity: fog, '--dur': '46s' } as CSSProperties}
        >
          <FogBank color="var(--smog)" />
        </div>
      )}

      <RidgeSvg>
        <Ridge
          body={NEAR_BODY}
          facets={NEAR}
          lit="var(--ridge-near-lit)"
          shade="var(--ridge-near-shade)"
        />
      </RidgeSvg>

      {fog > 0 && (
        <div
          className="scene-fog absolute left-[-6%] w-[112%]"
          style={
            {
              bottom: '0%',
              height: '28%',
              opacity: Math.round(fog * 0.85 * 100) / 100,
              '--dur': '58s',
              '--phase': '1',
            } as CSSProperties
          }
        >
          <FogBank color="var(--smog)" />
        </div>
      )}

      {layers.map(
        (layer, li) =>
          layer.length > 0 && (
            <div
              key={li}
              className="scene-drift absolute inset-y-0 left-0 w-[200%]"
              style={{ '--dur': li === 0 ? '140s' : '95s' } as CSSProperties}
            >
              {[0, 50].map((shift) =>
                layer.map((p, i) => (
                  <span
                    key={`${shift}-${i}`}
                    className={p.blob ? 'scene-blob absolute rounded-full' : 'absolute rounded-full'}
                    style={{
                      left: `${Math.round((p.x / HAZE_BOX.width) * 500) / 10 + shift}%`,
                      top: `${Math.round((p.y / HAZE_BOX.height) * 1000) / 10}%`,
                      width: p.blob ? `${p.r * 6}px` : `${p.r * 2}px`,
                      height: p.blob ? `${p.r * 6}px` : `${p.r * 2}px`,
                      opacity: p.opacity,
                      backgroundColor: p.blob ? undefined : 'var(--smog-particle)',
                    }}
                  />
                )),
              )}
            </div>
          ),
      )}

      {rain.length > 0 && (
        <div
          className="scene-fall absolute left-0 h-[200%] w-full"
          style={{ top: '-100%', '--dur': '1.1s' } as CSSProperties}
        >
          {[0, 50].map((shift) =>
            rain.map((r, i) => (
              <span
                key={`${shift}-${i}`}
                className="scene-raindrop absolute"
                style={{
                  left: `${r.x}%`,
                  top: `${r.y + shift}%`,
                  height: `${10 + r.d * 4}px`,
                  opacity: 0.25 + r.d * 0.12,
                }}
              />
            )),
          )}
        </div>
      )}

      {snow.length > 0 && (
        <div
          className="scene-fall absolute left-0 h-[200%] w-full"
          style={{ top: '-100%', '--dur': '11s' } as CSSProperties}
        >
          {[0, 50].map((shift) =>
            snow.map((s, i) => (
              <span
                key={`${shift}-${i}`}
                className="scene-snowflake absolute rounded-full"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y + shift}%`,
                  width: `${2 + s.d}px`,
                  height: `${2 + s.d}px`,
                  opacity: 0.5 + s.d * 0.2,
                }}
              />
            )),
          )}
        </div>
      )}
    </div>
  );
}
