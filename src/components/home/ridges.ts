/**
 * Процедурный рельеф для сцены в герое: гребни Заилийского Алатау как
 * фрактальный шум (fBm) поверх «массивов» — гауссовых холмов, задающих
 * главные вершины, — и low-poly-сетка треугольников по этому рельефу
 * для плоской фасетной подсветки. Детерминирован сидом: серверный HTML
 * воспроизводим. Чистая математика, без DOM — покрыта тестами.
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

export interface Point {
  x: number;
  y: number;
}

/**
 * Вершины low-poly-силуэта: перегибы сглаженного профиля (окно ~44 px),
 * полосы уже minWidth сливаются с соседними; каждая вершина уточняется
 * до настоящего экстремума профиля в окне — пики остаются острыми.
 * Первая вершина всегда на x = 0, последняя — на x = width.
 */
export function ridgeVertices(spec: RidgeSpec, box = SCENE_BOX, minWidth = 40): Point[] {
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

  const cuts = [0];
  let prevSign = 0;
  for (let i = 1; i < n; i += 1) {
    const d = smooth[i] - smooth[i - 1];
    const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) cuts.push(i - 1);
    if (sign !== 0) prevSign = sign;
  }
  cuts.push(n - 1);

  const merged = [cuts[0]];
  for (let i = 1; i < cuts.length; i += 1) {
    const last = merged[merged.length - 1];
    const narrow = (cuts[i] - last) * spec.step < minWidth;
    if (narrow && i < cuts.length - 1) continue;
    if (cuts[i] > last) merged.push(cuts[i]);
  }

  const xAt = (i: number) => Math.min(i * spec.step, box.width);
  const vertices: Point[] = [];
  for (let k = 0; k < merged.length; k += 1) {
    const c = merged[k];
    if (k === 0 || k === merged.length - 1) {
      vertices.push({ x: xAt(c), y: ys[c] });
      continue;
    }
    const peak = smooth[c] <= smooth[c - 1] && smooth[c] <= smooth[Math.min(n - 1, c + 1)];
    let best = c;
    for (let i = Math.max(0, c - half); i <= Math.min(n - 1, c + half); i += 1) {
      if (peak ? ys[i] < ys[best] : ys[i] > ys[best]) best = i;
    }
    const prev = vertices[vertices.length - 1];
    if (xAt(best) - prev.x < 8) continue;
    vertices.push({ x: xAt(best), y: ys[best] });
  }
  // Последняя вершина обязана быть на правом краю (уточнение могло её сдвинуть).
  const last = vertices[vertices.length - 1];
  if (last.x < box.width) vertices.push({ x: box.width, y: ys[n - 1] });
  return vertices;
}

export type Tone = 'lit' | 'mid' | 'shade';

export interface Triangle {
  d: string;
  tone: Tone;
  /** Треугольник под отрезком гребня (верхняя грань); false — встречный, у базы. */
  crest: boolean;
}

export interface RidgeMesh {
  triangles: Triangle[];
  /** Контур гребня до земли — для clipPath снега и тела под базовой линией. */
  outline: string;
  baseY: number;
}

function tri(a: Point, b: Point, c: Point): string {
  return `M${fmt(a.x)} ${fmt(a.y)} L${fmt(b.x)} ${fmt(b.y)} L${fmt(c.x)} ${fmt(c.y)} Z`;
}

/**
 * Low-poly-сетка гребня. Вершины силуэта V₀…Vₙ; базовые точки Bᵢ — на
 * линии baseY посередине между соседними вершинами, плюс крайние на x = 0
 * и x = width. Под каждым отрезком гребня — треугольник (Vᵢ, Vᵢ₊₁, Bᵢ):
 * склон спускается вправо → обращён к свету (светило справа) → lit, иначе
 * shade. Между ними встречные треугольники (Vᵢ, Bᵢ₋₁, Bᵢ) средним тоном.
 * Вместе они без зазоров замощают полосу между силуэтом и базовой линией.
 */
export function ridgeMesh(
  spec: RidgeSpec,
  baseY: number,
  box = SCENE_BOX,
  minWidth = 40,
): RidgeMesh {
  const v = ridgeVertices(spec, box, minWidth);
  const n = v.length;
  const bases: Point[] = [{ x: 0, y: baseY }];
  for (let i = 0; i < n - 1; i += 1) bases.push({ x: (v[i].x + v[i + 1].x) / 2, y: baseY });
  bases.push({ x: box.width, y: baseY });

  const triangles: Triangle[] = [];
  for (let i = 0; i < n; i += 1) {
    triangles.push({ d: tri(v[i], bases[i], bases[i + 1]), tone: 'mid', crest: false });
  }
  for (let i = 0; i < n - 1; i += 1) {
    const lit = v[i + 1].y > v[i].y;
    triangles.push({ d: tri(v[i], v[i + 1], bases[i + 1]), tone: lit ? 'lit' : 'shade', crest: true });
  }

  const outline =
    v.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ') +
    ` L${box.width} ${box.height} L0 ${box.height} Z`;

  return { triangles, outline, baseY };
}

/**
 * Полоса «неба до линии снега»: от верха viewBox вниз до ломаной
 * y = snowLineY + wobble·noise с шагом step (полигональный край в стиле
 * low-poly). В обрезке (clipPath) по граням остаются только вершины выше
 * линии — снежники, повторяющие рельеф.
 */
export function snowBandPath(
  snowLineY: number,
  wobble: number,
  seed: number,
  step = 48,
  box = SCENE_BOX,
): string {
  const parts: string[] = [`M0 0`, `L${box.width} 0`];
  for (let x = box.width; x >= 0; x -= step) {
    const y = snowLineY + wobble * noise1D(seed, x / 150);
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

/** Базовые линии сеток: дальний хребет уходит под средний, ближний — под землю. */
export const FAR_BASE_Y = 206;
export const MID_BASE_Y = 244;
export const NEAR_BASE_Y = 262;

/** Минимальная ширина грани: дальний хребет — мелкие острые грани, ближний — крупные. */
export const FAR_FACET_WIDTH = 34;
export const MID_FACET_WIDTH = 60;
export const NEAR_FACET_WIDTH = 96;

/** Линия снега дальнего хребта: выше неё (меньше y) склоны белые. */
export const SNOW_LINE_Y = 100;
export const SNOW_WOBBLE = 7;
export const SNOW_SEED = 5;
