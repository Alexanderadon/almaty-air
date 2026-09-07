import type { CSSProperties } from 'react';
import type { CurrentWeather } from '@/lib/sources/weather';
import { describeWeatherCode, sceneFor } from '@/lib/weather-codes';
import { HAZE_BOX, hazeLevel, hazeParticles } from './haze';
import {
  FAR_BASE_Y,
  FAR_MESH,
  MID_BASE_Y,
  MID_MESH,
  NEAR_BASE_Y,
  NEAR_MESH,
  RIDGE_FAR,
  RIDGE_MID,
  RIDGE_NEAR,
  type RidgeMesh,
  ridgeMesh,
  SCENE_BOX,
  silhouetteAt,
  SNOW_LINE_Y,
  SNOW_SEED,
  SNOW_WOBBLE,
  snowBandPath,
  type Tone,
} from './ridges';
import { SceneMotion } from './SceneMotion';
import { SceneWalkers } from './SceneWalkers';

export interface HeroSceneProps {
  /** AQI по городу — плотность смога; null — чистые горы. */
  aqi: number | null;
  /** Текущая погода — облака и осадки; null — одно облако, без осадков. */
  weather: CurrentWeather | null;
}

/* Сетки гребней и снег считаются один раз на модуль: сцена детерминирована. */
const FAR = ridgeMesh(RIDGE_FAR, FAR_BASE_Y, SCENE_BOX, FAR_MESH);
const MID = ridgeMesh(RIDGE_MID, MID_BASE_Y, SCENE_BOX, MID_MESH);
const NEAR = ridgeMesh(RIDGE_NEAR, NEAR_BASE_Y, SCENE_BOX, NEAR_MESH);
const SNOW = snowBandPath(SNOW_LINE_Y, SNOW_WOBBLE, SNOW_SEED);

/** Облака: ширина (% героя), высота положения (% сцены), период и сдвиг фазы. */
const CLOUDS = [
  { width: 26, top: 2, duration: 150, delay: -40, rest: 180, scale: 1 },
  { width: 19, top: 14, duration: 110, delay: -85, rest: 330, scale: 0.8 },
  { width: 32, top: 6, duration: 190, delay: -130, rest: 450, scale: 1.1 },
] as const;

/** Светило: справа от главного массива, над гребнями — свет на гранях идёт оттуда же. */
const LUMINARY = { cx: 1010, cy: 64, r: 15 };

/**
 * Засветка неба у горизонта: пять плоских полос нарастающей непрозрачности
 * от y = 58 до линии хребта. Ступени вместо градиента — намеренно, в тон
 * low-poly-сцене; нижние полосы почти целиком прячутся за гребнями.
 */
const SKY_BANDS = [0.035, 0.06, 0.09, 0.125, 0.16].map((opacity, i) => ({
  y: 58 + i * 19,
  h: 19 + (i === 4 ? 60 : 0),
  opacity,
}));

/** Целочисленный хэш → [0, 1): позиции звёзд, огней и капель без решётки и диагональных «строчек». */
function hash01(seed: number, i: number): number {
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
const STARS = Array.from({ length: 22 }, (_, i) => ({
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
const CITY_LIGHTS = Array.from({ length: 84 }, (_, i) => {
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
 * группами по краям (центр оставлен массиву). Силуэт из трёх ярусов.
 */
function spruce(x: number, base: number, h: number): string {
  const w = h * 0.34;
  const p = (dx: number, dy: number) => `${r1(x + dx)} ${r1(base - dy)}`;
  return (
    `M${p(0, h)} L${p(w * 0.55, h * 0.64)} L${p(w * 0.3, h * 0.64)} L${p(w * 0.82, h * 0.34)} ` +
    `L${p(w * 0.5, h * 0.34)} L${p(w, 0)} L${p(-w, 0)} L${p(-w * 0.5, h * 0.34)} ` +
    `L${p(-w * 0.82, h * 0.34)} L${p(-w * 0.3, h * 0.64)} L${p(-w * 0.55, h * 0.64)} Z`
  );
}

/*
 * Видимая часть viewBox: xMidYMax slice показывает на десктопе (сцена 260 px,
 * контейнер ~976 px) x ≈ 232…1208, на телефоне (сцена 150 px, ширина 390)
 * ≈ 382…1058. Ели и башня ставятся внутрь мобильной зоны — тогда они в кадре
 * везде; башня под луной (x 985 против 1010) — открыточная композиция.
 */
const SPRUCE_ZONES: readonly [number, number][] = [
  [390, 560],
  [860, 1050],
];
const SPRUCES = SPRUCE_ZONES.flatMap(([from, to], z) =>
  Array.from({ length: 12 }, (_, i) => {
    const x = from + (to - from) * hash01(21 + z, i * 2);
    const h = 13 + 17 * hash01(21 + z, i * 2 + 1);
    return spruce(x, silhouetteAt(NEAR.vertices, x) + 1.5, h);
  }),
);

/** Телебашня на Кок-Тобе — самый узнаваемый силуэт над городом; стоит на ближнем гребне. */
const TOWER_X = 985;
const TOWER_BASE = silhouetteAt(NEAR.vertices, TOWER_X) + 1;
const TOWER_H = 68;

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

/**
 * Гребень low-poly: под ломаной базовых точек — тело теневым тоном, выше —
 * треугольники сетки тремя тонами. Обводка в цвет заливки (0.8 px) гасит
 * волоски антиалиасинга на общих рёбрах соседних треугольников.
 */
function Ridge({ mesh, tones }: { mesh: RidgeMesh; tones: Record<Tone, string> }) {
  return (
    <>
      <path d={mesh.baseOutline} fill={tones.shade} />
      {mesh.triangles.map((t) => (
        <path
          key={t.d}
          d={t.d}
          fill={tones[t.tone]}
          stroke={tones[t.tone]}
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

const FAR_TONES: Record<Tone, string> = {
  lit: 'var(--ridge-far-lit)',
  mid: 'var(--ridge-far-mid)',
  shade: 'var(--ridge-far-shade)',
};
const MID_TONES: Record<Tone, string> = {
  lit: 'var(--ridge-mid-lit)',
  mid: 'var(--ridge-mid-mid)',
  shade: 'var(--ridge-mid-shade)',
};
const NEAR_TONES: Record<Tone, string> = {
  lit: 'var(--ridge-near-lit)',
  mid: 'var(--ridge-near-mid)',
  shade: 'var(--ridge-near-shade)',
};

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
 * Сцена в герое главной: небо (звёзды, луна с ореолом ночью, солнце
 * днём, редкая падающая звезда), облака, три гребня Заилийского Алатау
 * low-poly-сеткой (свет справа, где светило) со снежниками в два тона,
 * ели и телебашня Кок-Тобе на ближнем склоне, огни города у подножия,
 * дымка между гребнями, смог по AQI (туман и частицы) и осадки по погоде.
 * Ночные элементы (звёзды, луна, огни) в светлой теме прозрачны — там
 * сцена дневная.
 *
 * Движение — только transform на отдельных слоях-div с will-change
 * (композитор, без перерисовок): облака плывут, дымка «дышит», частицы
 * дрейфуют, дождь и снег падают, падающая звезда — короткая вспышка раз
 * в полминуты. rAF и canvas не используются. Вне экрана слои на паузе
 * (SceneMotion), при prefers-reduced-motion — статичный кадр.
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
      className="hero-scene pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150px] overflow-hidden sm:h-[260px]"
    >
      <SceneMotion />

      {/* Небо: ступенчатая засветка над хребтом (плоские полосы, без градиента —
          город подсвечивает небо у горизонта), звёзды и луна с ореолом ясной
          ночью, солнце днём. */}
      <RidgeSvg>
        {SKY_BANDS.map((b) => (
          <rect key={b.y} x={0} y={b.y} width={SCENE_BOX.width} height={b.h} fill="var(--skyglow)" opacity={b.opacity} />
        ))}
        {!isDay &&
          clearSky &&
          STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--star)" opacity={s.opacity} />
          ))}
        {clearSky &&
          (isDay ? (
            <>
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 22} fill="var(--sun)" opacity={0.08} />
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 10} fill="var(--sun)" opacity={0.12} />
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 1} fill="var(--sun)" />
            </>
          ) : (
            <>
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 20} fill="var(--moon)" opacity={0.05} />
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r + 9} fill="var(--moon)" opacity={0.07} />
              <circle cx={LUMINARY.cx} cy={LUMINARY.cy} r={LUMINARY.r} fill="var(--moon)" />
              <circle cx={LUMINARY.cx + 6} cy={LUMINARY.cy - 4} r={LUMINARY.r - 2} fill="var(--surface)" />
            </>
          ))}
      </RidgeSvg>

      {!isDay && clearSky && <div className="scene-shooting-star absolute" />}

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
          {/* Снег ложится на грани: белый — на освещённые, голубоватый — на теневые и встречные. */}
          <clipPath id="hero-far-lit">
            {FAR.triangles.filter((t) => t.tone === 'lit').map((t) => (
              <path key={t.d} d={t.d} />
            ))}
          </clipPath>
          <clipPath id="hero-far-shade">
            {FAR.triangles.filter((t) => t.tone !== 'lit').map((t) => (
              <path key={t.d} d={t.d} />
            ))}
          </clipPath>
        </defs>
        <Ridge mesh={FAR} tones={FAR_TONES} />
        <path d={SNOW} fill="var(--snow-shade)" clipPath="url(#hero-far-shade)" />
        <path d={SNOW} fill="var(--snow-lit)" clipPath="url(#hero-far-lit)" />
        <Ridge mesh={MID} tones={MID_TONES} />
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

      {/* Ближний гребень, ели и башня на нём, огни города у подножия */}
      <RidgeSvg>
        <Ridge mesh={NEAR} tones={NEAR_TONES} />
        <g fill="var(--spruce)">
          {SPRUCES.map((d) => (
            <path key={d} d={d} />
          ))}
          <rect x={TOWER_X - 1.6} y={TOWER_BASE - TOWER_H} width={3.2} height={TOWER_H} />
          <rect x={TOWER_X - 6} y={TOWER_BASE - TOWER_H * 0.62} width={12} height={6} />
          <rect x={TOWER_X - 4} y={TOWER_BASE - TOWER_H * 0.44} width={8} height={4} />
          <path
            d={`M${TOWER_X - 9} ${TOWER_BASE} L${TOWER_X - 1.6} ${TOWER_BASE - 18} L${TOWER_X + 1.6} ${TOWER_BASE - 18} L${TOWER_X + 9} ${TOWER_BASE} Z`}
          />
        </g>
        <circle cx={TOWER_X} cy={TOWER_BASE - TOWER_H - 1.5} r={2.2} fill="var(--tower-light)" />
        {CITY_LIGHTS.map((l, i) => (
          <circle key={i} cx={l.x} cy={l.y} r={l.r} fill="var(--city-light)" opacity={l.opacity} />
        ))}
      </RidgeSvg>

      {/* Прохожие по нижней кромке — под нижним слоем смога, в грязный воздух тонут в дымке */}
      <SceneWalkers />

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
