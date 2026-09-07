import type { CSSProperties } from 'react';
import { HAZE_BOX, hazeLevel, hazeParticles } from './haze';

export interface HeroSkylineProps {
  /** Текущий AQI по городу — задаёт плотность смога; null — чистые горы. */
  aqi: number | null;
  className?: string;
}

/*
 * Гребни в координатах viewBox 1440×220. Дальний — самый высокий, с
 * главным массивом правее центра и вторым пиком левее (так хребет видно
 * из центра города: Талгар восточнее, Большой Алматинский пик западнее).
 * Средний и ближний ниже и мягче; пики соседних гребней разнесены по X,
 * чтобы силуэты не сливались в одну пилу.
 */
const RIDGE_FAR =
  'M0 124 L30 116 L58 120 L90 104 L118 110 L146 96 L170 100 L198 84 L222 90 ' +
  'L250 74 L268 82 L292 66 L318 72 L344 58 L362 66 L390 52 L408 60 L434 48 ' +
  'L456 56 L478 42 L492 50 L514 44 L538 52 L560 62 L586 58 L612 70 L640 64 ' +
  'L668 76 L694 60 L714 68 L736 46 L750 38 L764 48 L782 42 L806 54 L828 50 ' +
  'L854 64 L878 60 L906 74 L934 68 L962 80 L990 74 L1020 86 L1048 80 L1078 92 ' +
  'L1104 86 L1136 98 L1166 92 L1198 104 L1228 98 L1262 110 L1296 104 L1330 114 ' +
  'L1366 110 L1402 120 L1440 116 L1440 220 L0 220 Z';

const RIDGE_MID =
  'M0 158 L44 150 L82 154 L120 138 L160 146 L196 130 L226 138 L262 122 L296 132 ' +
  'L330 118 L360 126 L396 110 L424 120 L460 106 L492 116 L526 102 L556 112 ' +
  'L590 100 L620 110 L652 96 L682 106 L718 92 L748 104 L784 90 L812 100 L848 88 ' +
  'L876 98 L912 90 L944 102 L980 96 L1014 108 L1050 100 L1086 112 L1120 106 ' +
  'L1156 118 L1192 112 L1228 124 L1266 118 L1302 130 L1340 124 L1380 136 ' +
  'L1440 132 L1440 220 L0 220 Z';

const RIDGE_NEAR =
  'M0 184 L50 178 L100 182 L150 170 L200 176 L250 164 L300 172 L350 160 L400 168 ' +
  'L450 156 L500 164 L550 154 L600 162 L650 152 L700 160 L750 150 L800 158 ' +
  'L850 152 L900 162 L950 156 L1000 166 L1050 160 L1100 170 L1150 164 L1200 174 ' +
  'L1250 168 L1300 178 L1350 172 L1400 180 L1440 176 L1440 220 L0 220 Z';

/** Снежники на трёх высших вершинах дальнего гребня — по ним силуэт читается как горы. */
const SNOW_CAPS = [
  'M420 58 L434 48 L456 56 L466 52 L458 60 L446 58 L438 64 L428 62 Z',
  'M462 56 L478 42 L492 50 L514 44 L524 52 L510 56 L500 62 L490 58 L480 64 L470 60 Z',
  'M724 56 L736 46 L750 38 L764 48 L782 42 L796 52 L782 56 L770 62 L758 56 L748 62 L738 58 Z',
];

/**
 * Силуэт Заилийского Алатау в герое главной + смог по текущему AQI.
 *
 * Серверный чистый SVG без клиентского JS. Три гребня плоскими заливками
 * (тон — подмес --foreground в --surface, работает в обеих темах), снежники
 * на вершинах. Поверх — туман (прозрачность одного нейтрального тона,
 * плотнее к земле: инверсия держит смог внизу) и частицы; их плотность
 * растёт с AQI (см. haze.ts): на чистом воздухе гор видно чётко, в смог
 * ближний гребень тонет в дымке. Частицы и туман один раз проявляются при
 * загрузке (CSS-анимация с fill-mode both, после — статичный кадр; при
 * prefers-reduced-motion — сразу конечное состояние).
 *
 * Позиционирование встроено: absolute к низу ближайшего relative-контейнера
 * (герой получает relative + isolate + overflow-hidden), -z-10 уводит слой
 * под текст. xMidYMax slice сохраняет пропорции: на узких экранах края
 * обрезаются, главный массив остаётся в центре.
 */
export function HeroSkyline({ aqi, className = '' }: HeroSkylineProps) {
  const { fog } = hazeLevel(aqi);
  const particles = hazeParticles(aqi);
  const { width, height } = HAZE_BOX;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[140px] w-full sm:h-[200px] ${className}`}
    >
      {fog > 0 && (
        <defs>
          <linearGradient id="hero-haze-fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopOpacity={0} style={{ stopColor: 'var(--smog)' }} />
            <stop offset="0.5" stopOpacity={0.7} style={{ stopColor: 'var(--smog)' }} />
            <stop offset="1" stopOpacity={1} style={{ stopColor: 'var(--smog)' }} />
          </linearGradient>
        </defs>
      )}

      <path d={RIDGE_FAR} fill="var(--ridge-far)" />
      {SNOW_CAPS.map((d) => (
        <path key={d} d={d} fill="var(--snow)" />
      ))}
      <path d={RIDGE_MID} fill="var(--ridge-mid)" />
      <path d={RIDGE_NEAR} fill="var(--ridge-near)" />

      {fog > 0 && (
        <g className="haze-fog" opacity={fog}>
          <rect x={0} y={70} width={width} height={height - 70} fill="url(#hero-haze-fog)" />
        </g>
      )}

      {particles.map((p, i) => (
        <circle
          key={i}
          className="haze-particle"
          cx={p.x}
          cy={p.y}
          r={p.r}
          opacity={p.opacity}
          fill={p.blob ? 'var(--smog)' : 'var(--smog-particle)'}
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </svg>
  );
}
