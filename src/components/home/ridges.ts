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
  baseY: 122,
  amplitude: 30,
  cell: 80,
  octaves: 4,
  ridged: true,
  massifs: [
    { x: 760, height: 66, width: 150 },
    { x: 470, height: 44, width: 110 },
    { x: 1110, height: 26, width: 170 },
  ],
  step: 6,
};

export const RIDGE_MID: RidgeSpec = {
  seed: 23,
  baseY: 172,
  amplitude: 22,
  cell: 95,
  octaves: 3,
  ridged: false,
  massifs: [
    { x: 300, height: 26, width: 140 },
    { x: 990, height: 30, width: 180 },
  ],
  step: 8,
};

export const RIDGE_NEAR: RidgeSpec = {
  seed: 37,
  baseY: 210,
  amplitude: 12,
  cell: 140,
  octaves: 2,
  ridged: false,
  massifs: [
    { x: 620, height: 14, width: 220 },
    { x: 1300, height: 10, width: 200 },
  ],
  step: 10,
};

/** Линия снега дальнего хребта: выше неё (меньше y) склоны белые. */
export const SNOW_LINE_Y = 84;
export const SNOW_WOBBLE = 7;
export const SNOW_SEED = 5;
