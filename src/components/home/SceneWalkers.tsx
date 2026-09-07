import type { CSSProperties } from 'react';
import { NEAR_VERTICES, SCENE_BOX, silhouetteAt } from './ridges';

/**
 * Прохожие на ближнем склоне: человек в капюшоне с тросточкой, барашек,
 * собака и велосипедист по очереди идут по линии гребня — траектория
 * каждого посчитана из вершин low-poly-силуэта и записана в @keyframes
 * (постоянная скорость по X, y — рельеф). Один общий цикл WALK_CYCLE_S:
 * каждый идёт первые WALK_SHARE цикла и прячется, следующий выходит по
 * своей задержке.
 *
 * Походка — покадровая: у человека четыре кадра (опора, проход, опора
 * другой ногой, проход), у остальных два; кадры переключаются steps() с
 * разбегом по индексу, корпус переваливается ±4° от стоп в такт шагам.
 * Силуэты тёмные, как ели.
 *
 * Слой — отдельный SVG с тем же viewBox и обрезкой, что у гребней, поэтому
 * координаты совпадают и на телефоне, и на десктопе. При reduced motion
 * прохожих нет (анимации отключены, базовое состояние — hidden).
 */

/** Полный цикл смены персонажей, с. */
export const WALK_CYCLE_S = 400;
/** Доля цикла, которую идёт один персонаж (80 с — медленно). */
export const WALK_SHARE = 0.2;
/** Запас за краями viewBox, чтобы выходить и уходить за кадр. */
const MARGIN = 48;

interface Walker {
  name: string;
  /** Масштаб силуэта (локальная коробка 40×40, стопы на y = 40). */
  scale: number;
  /** Задержка выхода внутри цикла, с. */
  delay: number;
  /** Идёт слева направо (силуэты нарисованы идущими влево — зеркалим). */
  toRight: boolean;
  /** Длительность полного шага (все кадры), с. */
  stride: number;
  /** Кадры походки по порядку. */
  poses: React.ReactNode[];
}

const LIMB = {
  fill: 'none',
  stroke: 'var(--figure)',
  strokeWidth: 3.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* ---------- Человек в капюшоне с тросточкой (идёт влево) ----------
   Капюшон-купол с острым затылком, пальто трапецией; руки и ноги —
   толстые штрихи; трость — тонкий штрих от кисти до земли. Четыре кадра:
   1 опора (левая нога впереди, трость воткнута спереди), 2 проход (трость
   под кистью, опорная), 3 опора другой ногой (трость летит вперёд),
   4 проход (трость почти воткнута). */
const HOOD_AND_COAT = (
  <>
    <path d="M13 13.5C12.6 6.2 16.4 2.6 20.4 2.6c5.9 0 8.2 5.6 7.2 11.4z" />
    <path d="M14.4 13h11.8l2.6 16.6H11.4z" />
  </>
);

function person(
  frontLeg: string,
  backLeg: string,
  caneArm: string,
  backArm: string,
  cane: string,
): React.ReactNode {
  return (
    <>
      {HOOD_AND_COAT}
      <g {...LIMB}>
        <path d={frontLeg} />
        <path d={backLeg} />
        <path d={caneArm} />
        <path d={backArm} />
      </g>
      <path d={cane} fill="none" stroke="var(--figure)" strokeWidth="2.2" strokeLinecap="round" />
      {/* Рукоять трости — в кисти передней руки (начало пути трости). */}
      <circle cx={Number(cane.slice(1).split(/[ ,L]/)[0])} cy={Number(cane.slice(1).split(/[ ,L]/)[1])} r="1.9" />
    </>
  );
}

const PERSON_POSES = [
  person(
    'M17 29L13 34l-2 5',
    'M22 29l3 5 3 5',
    'M15.5 16l-3.5 5-1.5 5',
    'M24.5 16l3 5-.5 5',
    'M10.5 26L7.5 39.5',
  ),
  person(
    'M17 29l.5 5 .5 5',
    'M22 29l1 5-1 4.5',
    'M15.5 16l-2.5 5-1.5 4.5',
    'M24.5 16l1.5 5-.5 5',
    'M11.5 25.5L12 39.5',
  ),
  person(
    'M17 29l3 5 3 5',
    'M22 29l-4 5-3 5',
    'M15.5 16l-3.5 5-2 4.5',
    'M24.5 16l.5 5-1 5',
    'M10 25.5L9 37',
  ),
  person(
    'M17 29l0 5-.5 4.5',
    'M22 29l-1 5-.5 5',
    'M15.5 16l-3 5-2 5',
    'M24.5 16l1.5 5-.5 5',
    'M10.5 26L8.5 39.5',
  ),
];

/* ---------- Барашек ---------- */
const SHEEP_BODY = (
  <>
    <ellipse cx="20" cy="30" rx="10.5" ry="6.5" />
    <circle cx="12" cy="26" r="4" />
    <circle cx="19" cy="24" r="4.5" />
    <circle cx="26" cy="25.5" r="4" />
    <circle cx="8.5" cy="30" r="3.2" />
    <path d="M5.5 28.5l-1.6-2.6 2.4.6z" />
  </>
);
const SHEEP_LEGS = { ...LIMB, strokeWidth: 2.4 };
const SHEEP_POSES = [
  <>
    {SHEEP_BODY}
    <g {...SHEEP_LEGS}>
      <path d="M13 35l-1 5M17 35l1 5M23 35l-1 5M27 35l1 5" />
    </g>
  </>,
  <>
    {SHEEP_BODY}
    <g {...SHEEP_LEGS}>
      <path d="M13 35l1 5M17 35l-1 5M23 35l1 5M27 35l-1 5" />
    </g>
  </>,
];

/* ---------- Собака ---------- */
const DOG_BODY = (
  <>
    <ellipse cx="20" cy="32" rx="8.5" ry="3.8" />
    <circle cx="10.5" cy="29.5" r="3" />
    <path d="M8.2 27.5l-1.4-2.6 2.6 1z" />
    <path d="M28 31l4.5-4.5" {...LIMB} strokeWidth={2} />
  </>
);
const DOG_LEGS = { ...LIMB, strokeWidth: 2 };
const DOG_POSES = [
  <>
    {DOG_BODY}
    <g {...DOG_LEGS}>
      <path d="M14 35l-1.5 5M17.5 35l1 5M23 35l-1 5M26 35l1.5 5" />
    </g>
  </>,
  <>
    {DOG_BODY}
    <g {...DOG_LEGS}>
      <path d="M14 35l1 5M17.5 35l-1.5 5M23 35l1.5 5M26 35l-1 5" />
    </g>
  </>,
];

/* ---------- Велосипедист ---------- */
const BIKE = (
  <g {...LIMB} strokeWidth={2}>
    <circle cx="11" cy="34" r="5.5" />
    <circle cx="29" cy="34" r="5.5" />
    <path d="M11 34l7-9h8l3 9M18 25l3 9M20 34h-9M25 25l-2-3" />
  </g>
);
const RIDER = (
  <>
    <circle cx="23.5" cy="12" r="3.2" />
    <g {...LIMB} strokeWidth={3}>
      <path d="M23 15.5l-4 8M22 18l3.5 4.5" />
    </g>
  </>
);
const CYCLIST_POSES = [
  <>
    {BIKE}
    {RIDER}
    <g {...LIMB} strokeWidth={3}>
      <path d="M19 23.5l-1 6 3 4M19 23.5l4 4-1 6" />
    </g>
  </>,
  <>
    {BIKE}
    {RIDER}
    <g {...LIMB} strokeWidth={3}>
      <path d="M19 23.5l3 6-2 4M19 23.5l-3 5 4 5" />
    </g>
  </>,
];

const WALKERS: Walker[] = [
  { name: 'person', scale: 0.95, delay: 4, toRight: false, stride: 1.1, poses: PERSON_POSES },
  { name: 'sheep', scale: 0.85, delay: 104, toRight: true, stride: 0.7, poses: SHEEP_POSES },
  { name: 'dog', scale: 0.72, delay: 204, toRight: false, stride: 0.5, poses: DOG_POSES },
  { name: 'cyclist', scale: 0.92, delay: 304, toRight: true, stride: 0.8, poses: CYCLIST_POSES },
];

function fmt(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * @keyframes прохода по рельефу: опорные точки — края с запасом и все
 * вершины силуэта между ними; процент кадра пропорционален пройденному X
 * (скорость постоянна), y — линия гребня. После WALK_SHARE — скрыт до конца цикла.
 */
export function walkKeyframes(name: string, toRight: boolean): string {
  const from = toRight ? -MARGIN : SCENE_BOX.width + MARGIN;
  const to = toRight ? SCENE_BOX.width + MARGIN : -MARGIN;
  const inner = NEAR_VERTICES.map((v) => v.x).filter((x) => x > 0 && x < SCENE_BOX.width);
  const xs = [from, ...(toRight ? inner : [...inner].reverse()), to];
  const total = Math.abs(to - from);
  const frames = xs.map((x) => {
    const p = (WALK_SHARE * 100 * Math.abs(x - from)) / total;
    const y = silhouetteAt(NEAR_VERTICES, x) + 1;
    return `${p.toFixed(2)}%{transform:translate(${fmt(x)}px,${fmt(y)}px);visibility:visible}`;
  });
  const endY = silhouetteAt(NEAR_VERTICES, to) + 1;
  frames.push(
    `${(WALK_SHARE * 100 + 0.01).toFixed(2)}%,100%{transform:translate(${fmt(to)}px,${fmt(endY)}px);visibility:hidden}`,
  );
  return `@keyframes scene-walk-${name}{${frames.join('')}}`;
}

const WALK_CSS =
  '@media (prefers-reduced-motion: no-preference){' +
  WALKERS.map((w) => walkKeyframes(w.name, w.toRight)).join('') +
  '}';

export function SceneWalkers() {
  return (
    <>
      <style>{WALK_CSS}</style>
      <svg
        viewBox={`0 0 ${SCENE_BOX.width} ${SCENE_BOX.height}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        {WALKERS.map((w) => {
          const s = w.scale;
          // Якорь — центр стоп (локальные 20, 40) в точке траектории; идущих
          // вправо зеркалим относительно локальной вертикальной оси.
          const anchor = `translate(${fmt(-20 * s)} ${fmt(-40 * s)}) scale(${s})`;
          const flip = w.toRight ? ' translate(40 0) scale(-1 1)' : '';
          const frames = w.poses.length;
          return (
            <g
              key={w.name}
              data-walker={w.name}
              className="scene-walker"
              style={
                {
                  animationName: `scene-walk-${w.name}`,
                  '--delay': `${w.delay}s`,
                } as CSSProperties
              }
            >
              <g
                className="scene-walker-body"
                style={{ animationDuration: `${w.stride / 2}s` } as CSSProperties}
              >
                <g transform={anchor + flip} fill="var(--figure)">
                  {w.poses.map((pose, i) => (
                    <g
                      key={i}
                      className="scene-pose"
                      data-frame={i}
                      style={
                        {
                          animationName: `scene-pose-${frames}`,
                          animationDuration: `${w.stride}s`,
                          // Положительная задержка: кадр i виден на i-й доле шага (с отрицательной
                          // порядок разворачивается — персонаж шёл бы задом наперёд).
                          animationDelay: `${((i * w.stride) / frames).toFixed(3)}s`,
                        } as CSSProperties
                      }
                    >
                      {pose}
                    </g>
                  ))}
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </>
  );
}
