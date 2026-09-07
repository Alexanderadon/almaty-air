import type { CSSProperties } from 'react';

/**
 * Прохожие у подножия: человек, барашек, собака и велосипедист по очереди
 * пересекают сцену по нижней кромке. Один общий цикл (см. --walk-cycle в
 * globals.css): каждый идёт свои 22% цикла и прячется, следующий выходит
 * через паузу. Походка — два кадра, переключаются steps() раз в 0,35 с,
 * плюс лёгкое покачивание. Движение — transform на слое-div, кадры —
 * opacity двух групп внутри крошечного SVG. Без анимаций (reduced motion)
 * прохожих нет: базовое состояние — visibility: hidden.
 *
 * Все силуэты нарисованы идущими влево; чётные персонажи идут вправо —
 * анимация задом наперёд (animation-direction: reverse) и зеркало по X.
 */

interface Walker {
  name: string;
  /** Высота силуэта в px (сцена 170/260 px). */
  height: number;
  /** Задержка выхода внутри цикла, с. */
  delay: number;
  /** Идёт вправо (зеркало + обратная анимация). */
  reverse: boolean;
  a: React.ReactNode;
  b: React.ReactNode;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* Человек: голова, корпус, руки и ноги в двух фазах шага. Стопы на y = 40. */
const PERSON_A = (
  <g {...STROKE}>
    <circle cx="20" cy="6.5" r="3.4" fill="currentColor" stroke="none" />
    <path d="M20 10v14" />
    <path d="M20 13l-6 7M20 13l6 6" />
    <path d="M20 24l-6 14M20 24l7 13" />
  </g>
);
const PERSON_B = (
  <g {...STROKE}>
    <circle cx="20" cy="6.5" r="3.4" fill="currentColor" stroke="none" />
    <path d="M20 10v14" />
    <path d="M20 13l-3 8M20 13l3 8" />
    <path d="M20 24l-2 14M20 24l3 14" />
  </g>
);

/* Барашек: шерсть кругами, голова, четыре ноги в двух фазах. */
const SHEEP_BODY = (
  <g fill="currentColor">
    <ellipse cx="20" cy="30" rx="10.5" ry="6.5" />
    <circle cx="12" cy="26" r="4" />
    <circle cx="19" cy="24" r="4.5" />
    <circle cx="26" cy="25.5" r="4" />
    <circle cx="8.5" cy="30" r="3.2" />
    <path d="M5.5 28.5l-1.6-2.6 2.4 0.6z" />
  </g>
);
const SHEEP_A = (
  <>
    {SHEEP_BODY}
    <g {...STROKE} strokeWidth={2.2}>
      <path d="M13 35v5M17 35v5M23 35v5M27 35v5" />
    </g>
  </>
);
const SHEEP_B = (
  <>
    {SHEEP_BODY}
    <g {...STROKE} strokeWidth={2.2}>
      <path d="M13 35l-1.5 5M17 35l1.5 5M23 35l-1.5 5M27 35l1.5 5" />
    </g>
  </>
);

/* Собака: корпус, голова, хвост, четыре ноги. */
const DOG_BODY = (
  <g fill="currentColor">
    <ellipse cx="20" cy="32" rx="8.5" ry="3.8" />
    <circle cx="10.5" cy="29.5" r="3" />
    <path d="M8.2 27.5l-1.4-2.6 2.6 1z" />
    <path d="M28 31l4.5-4.5" {...STROKE} strokeWidth={2} />
  </g>
);
const DOG_A = (
  <>
    {DOG_BODY}
    <g {...STROKE} strokeWidth={2}>
      <path d="M14 35l-1.5 5M17.5 35l1 5M23 35l-1 5M26 35l1.5 5" />
    </g>
  </>
);
const DOG_B = (
  <>
    {DOG_BODY}
    <g {...STROKE} strokeWidth={2}>
      <path d="M14 35l1 5M17.5 35l-1.5 5M23 35l1.5 5M26 35l-1 5" />
    </g>
  </>
);

/* Велосипедист: два колеса, рама, наездник; ноги в двух положениях педалей. */
const BIKE = (
  <g {...STROKE} strokeWidth={2}>
    <circle cx="11" cy="34" r="5.5" />
    <circle cx="29" cy="34" r="5.5" />
    <path d="M11 34l7-9h8l3 9M18 25l3 9M20 34h-9" />
    <path d="M25 25l-2-3" />
  </g>
);
const RIDER = (
  <g {...STROKE}>
    <circle cx="23.5" cy="12" r="3.2" fill="currentColor" stroke="none" />
    <path d="M23 15.5l-4 8" />
    <path d="M22 18l3.5 4.5" />
  </g>
);
const CYCLIST_A = (
  <>
    {BIKE}
    {RIDER}
    <g {...STROKE}>
      <path d="M19 23.5l-1 6 3 4M19 23.5l4 4-1 6" />
    </g>
  </>
);
const CYCLIST_B = (
  <>
    {BIKE}
    {RIDER}
    <g {...STROKE}>
      <path d="M19 23.5l3 6-2 4M19 23.5l-3 5 4 5" />
    </g>
  </>
);

const WALKERS: Walker[] = [
  { name: 'person', height: 34, delay: 4, reverse: false, a: PERSON_A, b: PERSON_B },
  { name: 'sheep', height: 20, delay: 54, reverse: true, a: SHEEP_A, b: SHEEP_B },
  { name: 'dog', height: 15, delay: 104, reverse: false, a: DOG_A, b: DOG_B },
  { name: 'cyclist', height: 30, delay: 154, reverse: true, a: CYCLIST_A, b: CYCLIST_B },
];

export function SceneWalkers() {
  return (
    <>
      {WALKERS.map((w) => (
        <div
          key={w.name}
          data-walker={w.name}
          className="scene-walker absolute bottom-0 left-full"
          style={
            {
              height: `${w.height}px`,
              width: `${w.height}px`,
              '--delay': `${w.delay}s`,
              animationDirection: w.reverse ? 'reverse' : 'normal',
            } as CSSProperties
          }
        >
          <div className={`scene-walker-body h-full w-full ${w.reverse ? 'scene-walker-flip' : ''}`}>
            <svg
              viewBox="0 0 40 40"
              className="block h-full w-full"
              aria-hidden="true"
              focusable="false"
              style={{ color: 'var(--figure)' }}
            >
              <g className="scene-pose-a">{w.a}</g>
              <g className="scene-pose-b">{w.b}</g>
            </svg>
          </div>
        </div>
      ))}
    </>
  );
}
