/**
 * Процедурный рельеф для сцены в герое: гребни Заилийского Алатау как
 * фрактальный шум (fBm) поверх «массивов» — гауссовых холмов, задающих
 * главные вершины. Детерминирован сидом: серверный HTML воспроизводим.
 * Чистая математика, без DOM — покрыта тестами.
 */

/** Габариты viewBox сцены; y = height — «земля». */
export const SCENE_BOX = { width: 1440, height: 260 } as const;

export interface Massif {
  /** Центр массива по X. */
  x: number;
  /** Высота над базовой линией гребня. */
  height: number;
  /** Полуширина (сигма гауссианы). */
  width: number;
}

export interface RidgeSpec {
  seed: number;
  /** Базовая линия гребня (y при нулевом шуме). */
  baseY: number;
  /** Размах шума по вертикали. */
  amplitude: number;
  /** Частота шума: сколько единиц X в одной ячейке решётки (больше — плавнее). */
  cell: number;
  /** Число октав fBm: больше — мельче детали. */
  octaves: number;
  /** «Гребневой» шум (1 − |n|): острые пики вместо волн — для дальнего хребта. */
  ridged: boolean;
  massifs: readonly Massif[];
  /** Шаг дискретизации по X. */
  step: number;
}

/** Хэш решётки → [0, 1): целочисленная арифметика, одинаковая на любой платформе. */
function lattice(seed: number, i: number): number {
  let h = (Math.imul(seed, 374761393) + Math.imul(i, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Значимый шум 1D в [−1, 1] со smoothstep-интерполяцией между узлами. */
function noise1D(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  const a = lattice(seed, i) * 2 - 1;
  const b = lattice(seed, i + 1) * 2 - 1;
  return a + (b - a) * s;
}

/** fBm: сумма октав с убывающей амплитудой и растущей частотой, нормирована в [−1, 1]. */
function fbm(seed: number, x: number, octaves: number, ridged: boolean): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    let n = noise1D(seed + o * 101, x * freq);
    if (ridged) n = (1 - Math.abs(n)) * 2 - 1;
    sum += amp * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function fmt(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Профиль гребня: y для каждого x = 0, step, 2·step, …, width. */
export function ridgeProfile(spec: RidgeSpec, box = SCENE_BOX): number[] {
  const ys: number[] = [];
  for (let x = 0; x <= box.width; x += spec.step) {
    let y = spec.baseY - spec.amplitude * fbm(spec.seed, x / spec.cell, spec.octaves, spec.ridged);
    for (const m of spec.massifs) {
      const d = (x - m.x) / m.width;
      y -= m.height * Math.exp(-d * d);
    }
    ys.push(Math.min(box.height - 4, Math.max(4, y)));
  }
  return ys;
}

/** Замкнутый path гребня: линия профиля, затем вниз к земле и обратно. */
export function ridgePath(spec: RidgeSpec, box = SCENE_BOX): string {
  const ys = ridgeProfile(spec, box);
  const parts = ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${fmt(Math.min(i * spec.step, box.width))} ${fmt(y)}`);
  return `${parts.join(' ')} L${box.width} ${box.height} L0 ${box.height} Z`;
}

export interface Facet {
  /** Замкнутый path вертикальной полосы под профилем между двумя перегибами. */
  d: string;
  /** Склон обращён к свету (свет справа: склон спускается вправо). */
  lit: boolean;
}

/** Нахлёст соседних граней, чтобы антиалиасинг не рисовал светлый волосок на стыке. */
const FACET_OVERLAP = 0.7;

/**
 * Грани гребня для плоской «фасетной» подсветки: профиль сглаживается
 * окном ~44 px, перегибы сглаженной кривой режут хребет на полосы; полосы
 * уже minWidth сливаются с соседними. Каждая полоса — склон: спускается
 * вправо → обращён к свету (луна/солнце справа) → lit.
 *
 * Грань — лента глубиной depth под линией гребня (нижний край повторяет
 * профиль), а не столб до земли: столбы читались вертикальными полосами.
 * Тело гребня под лентами заливается теневым тоном отдельно (ridgePath).
 * Соседние ленты стыкуются с нахлёстом FACET_OVERLAP, чтобы антиалиасинг
 * не рисовал светлый волосок на шве.
 */
export function ridgeFacets(
  spec: RidgeSpec,
  box = SCENE_BOX,
  minWidth = 28,
  depth = 48,
): Facet[] {
  const ys = ridgeProfile(spec, box);
  const n = ys.length;
  const half = Math.max(1, Math.round(22 / spec.step));
  const smooth = ys.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = i - half; k <= i + half; k += 1) {
      if (k >= 0 && k < n) {
        sum += ys[k];
        count += 1;
      }
    }
    return sum / count;
  });

  // Перегибы сглаженного профиля (смена знака производной).
  const cuts = [0];
  let prevSign = 0;
  for (let i = 1; i < n; i += 1) {
    const d = smooth[i] - smooth[i - 1];
    const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) cuts.push(i - 1);
    if (sign !== 0) prevSign = sign;
  }
  cuts.push(n - 1);

  // Узкие полосы — в соседнюю; последняя граница (правый край) остаётся всегда.
  const merged = [cuts[0]];
  for (let i = 1; i < cuts.length; i += 1) {
    const last = merged[merged.length - 1];
    const narrow = (cuts[i] - last) * spec.step < minWidth;
    if (narrow && i < cuts.length - 1) continue;
    if (cuts[i] > last) merged.push(cuts[i]);
  }

  const facets: Facet[] = [];
  const xAt = (i: number) => Math.min(i * spec.step, box.width);
  for (let k = 0; k < merged.length - 1; k += 1) {
    const i0 = merged[k];
    const i1 = merged[k + 1];
    const lit = smooth[i1] > smooth[i0];
    const x0 = k === 0 ? 0 : xAt(i0) - FACET_OVERLAP;
    const x1 = k === merged.length - 2 ? box.width : xAt(i1) + FACET_OVERLAP;
    // Лента сужается от вершины (полная глубина) к долине (четверть):
    // освещённая грань читается треугольником склона, а не прямоугольником.
    const peakAtStart = smooth[i0] < smooth[i1];
    const span = Math.max(1, i1 - i0);
    const low = (i: number) => {
      const t = (i - i0) / span;
      const taper = peakAtStart ? 1 - 0.75 * t : 0.25 + 0.75 * t;
      return fmt(Math.min(box.height, ys[i] + depth * taper));
    };
    const top: string[] = [];
    for (let i = i0; i <= i1; i += 1) top.push(`L${fmt(xAt(i))} ${fmt(ys[i])}`);
    const bottom: string[] = [];
    for (let i = i1; i >= i0; i -= 1) bottom.push(`L${fmt(xAt(i))} ${low(i)}`);
    facets.push({
      d:
        `M${fmt(x0)} ${low(i0)} L${fmt(x0)} ${fmt(ys[i0])} ${top.join(' ')} ` +
        `L${fmt(x1)} ${fmt(ys[i1])} L${fmt(x1)} ${low(i1)} ${bottom.join(' ')} Z`,
      lit,
    });
  }
  return facets;
}

/**
 * Полоса «неба до линии снега»: от верха viewBox вниз до волнистой линии
 * y = snowLineY + wobble·noise. В обрезке (clipPath) по гребню остаются
 * только вершины выше линии — естественные снежники, повторяющие рельеф.
 */
export function snowBandPath(
  snowLineY: number,
  wobble: number,
  seed: number,
  step = 12,
  box = SCENE_BOX,
): string {
  const parts: string[] = [`M0 0`, `L${box.width} 0`];
  for (let x = box.width; x >= 0; x -= step) {
    const y = snowLineY + wobble * noise1D(seed, x / 70);
    parts.push(`L${fmt(x)} ${fmt(y)}`);
  }
  return `${parts.join(' ')} Z`;
}

/** Гребни сцены: дальний (высокий, острый, со снегом), средний, ближний (предгорья). */
export const RIDGE_FAR: RidgeSpec = {
  seed: 11,
  baseY: 138,
  amplitude: 30,
  cell: 80,
  octaves: 4,
  ridged: true,
  massifs: [
    { x: 760, height: 62, width: 150 },
    { x: 470, height: 44, width: 110 },
    { x: 1110, height: 26, width: 170 },
  ],
  step: 6,
};

export const RIDGE_MID: RidgeSpec = {
  seed: 23,
  baseY: 184,
  amplitude: 20,
  cell: 95,
  octaves: 3,
  ridged: false,
  massifs: [
    { x: 300, height: 24, width: 140 },
    { x: 990, height: 28, width: 180 },
  ],
  step: 8,
};

export const RIDGE_NEAR: RidgeSpec = {
  seed: 37,
  baseY: 226,
  amplitude: 10,
  cell: 140,
  octaves: 2,
  ridged: false,
  massifs: [
    { x: 620, height: 12, width: 220 },
    { x: 1300, height: 8, width: 200 },
  ],
  step: 10,
};

/** Линия снега дальнего хребта: выше неё (меньше y) склоны белые. */
export const SNOW_LINE_Y = 100;
export const SNOW_WOBBLE = 7;
export const SNOW_SEED = 5;
