import type { CSSProperties } from 'react';
import type { CurrentWeather } from '@/lib/sources/weather';
import { describeWeatherCode, sceneFor } from '@/lib/weather-codes';
import { HAZE_BOX, hazeLevel, hazeParticles } from './haze';
import {
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
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

/* Пути гребней считаются один раз на модуль: сцена детерминирована. */
const FAR = ridgePath(RIDGE_FAR);
const MID = ridgePath(RIDGE_MID);
const NEAR = ridgePath(RIDGE_NEAR);
const SNOW = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);

/** Облака: ширина (% героя), высота положения (% сцены), период и сдвиг фазы. */
const CLOUDS = [
  { width: 26, top: 2, duration: 150, delay: -40, rest: 180, scale: 1 },
  { width: 19, top: 14, duration: 110, delay: -85, rest: 330, scale: 0.8 },
  { width: 32, top: 6, duration: 190, delay: -130, rest: 450, scale: 1.1 },
] as const;

/** Целочисленный хэш → [0, 1): позиции капель без решётки и диагональных «строчек». */
function hash01(seed: number, i: number): number {
  let h = (Math.imul(seed, 374761393) + Math.imul(i, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

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

function FogBank() {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="var(--smog)" opacity="0.5">
        <ellipse cx="220" cy="50" rx="430" ry="28" />
        <ellipse cx="720" cy="44" rx="540" ry="34" />
        <ellipse cx="1240" cy="52" rx="420" ry="26" />
        <ellipse cx="470" cy="64" rx="380" ry="18" />
      </g>
    </svg>
  );
}

/**
 * Сцена в герое главной: небо с облаками, три гребня Заилийского Алатау
 * со снежниками, смог по AQI (туман и частицы) и осадки по погоде.
 *
 * Движение — только transform на отдельных слоях-div с will-change
 * (композитор, без перерисовок): облака плывут, туман «дышит», частицы
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

      <svg
        viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id="hero-far-ridge">
            <path d={FAR} />
          </clipPath>
        </defs>
        <path d={FAR} fill="var(--ridge-far)" />
        <path d={SNOW} fill="var(--snow)" clipPath="url(#hero-far-ridge)" />
        <path d={MID} fill="var(--ridge-mid)" />
      </svg>

      {fog > 0 && (
        <div
          className="scene-fog absolute left-[-6%] w-[112%]"
          style={{ bottom: '18%', height: '36%', opacity: fog, '--dur': '46s' } as CSSProperties}
        >
          <FogBank />
        </div>
      )}

      <svg
        viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        <path d={NEAR} fill="var(--ridge-near)" />
      </svg>

      {fog > 0 && (
        <div
          className="scene-fog absolute left-[-6%] w-[112%]"
          style={
            {
              bottom: '0%',
              height: '30%',
              opacity: Math.round(fog * 0.85 * 100) / 100,
              '--dur': '58s',
              '--phase': '1',
            } as CSSProperties
          }
        >
          <FogBank />
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
