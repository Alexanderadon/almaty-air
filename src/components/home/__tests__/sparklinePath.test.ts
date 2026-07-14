/**
 * Тесты геометрии спарклайна: масштабирование в рамку с отступами,
 * разрывы линии на null-значениях, вырожденные и константные серии.
 * Габариты по умолчанию (120×28, pad 2): X — от 2 до 118, Y — от 2 (max)
 * до 26 (min), базовая линия области — 26.
 */

import { describe, expect, it } from 'vitest';

import { SPARKLINE_BOX, sparklineGeometry } from '../sparklinePath';

describe('sparklineGeometry', () => {
  it('пустая серия и одна точка → null', () => {
    expect(sparklineGeometry([])).toBeNull();
    expect(sparklineGeometry([50])).toBeNull();
    expect(sparklineGeometry([50, null])).toBeNull();
    expect(sparklineGeometry([null, null, null])).toBeNull();
  });

  it('два значения, но оба изолированы пропуском → рисовать нечего, null', () => {
    expect(sparklineGeometry([50, null, 60])).toBeNull();
  });

  it('две точки: min на нижнем краю (26), max на верхнем (2), X от 2 до 118', () => {
    const geometry = sparklineGeometry([0, 100]);
    expect(geometry).not.toBeNull();
    expect(geometry?.line).toBe('M 2 26 L 118 2');
    expect(geometry?.area).toBe('M 2 26 L 2 26 L 118 2 L 118 26 Z');
    expect(geometry?.last).toBe(100);
  });

  it('null разрывает линию на два M-сегмента и две области', () => {
    const geometry = sparklineGeometry([10, 20, null, 30, 40]);
    expect(geometry).not.toBeNull();
    // X равномерно: 2, 31, 60, 89, 118; Y: 10→26, 20→18, 30→10, 40→2.
    expect(geometry?.line).toBe('M 2 26 L 31 18 M 89 10 L 118 2');
    expect(geometry?.area).toBe(
      'M 2 26 L 2 26 L 31 18 L 31 26 Z M 89 26 L 89 10 L 118 2 L 118 26 Z',
    );
  });

  it('константная серия — горизонтальная линия посередине (14)', () => {
    const geometry = sparklineGeometry([42, 42, 42]);
    expect(geometry?.line).toBe('M 2 14 L 60 14 L 118 14');
  });

  it('ведущие и замыкающие null не сдвигают X оставшихся точек', () => {
    // 4 позиции: шаг 116/3 ≈ 38.67; рисуемые точки на индексах 1 и 2.
    const geometry = sparklineGeometry([null, 10, 20, null]);
    expect(geometry?.line).toBe('M 40.67 26 L 79.33 2');
  });

  it('last — последнее непустое значение, даже если оно изолировано и не рисуется', () => {
    const geometry = sparklineGeometry([10, 20, null, 35]);
    expect(geometry).not.toBeNull();
    expect(geometry?.last).toBe(35);
    // Изолированная точка участвует в масштабе Y: max = 35 → 20 не на верхнем краю.
    expect(geometry?.line).toBe('M 2 26 L 40.67 16.4');
  });

  it('координаты не выходят за рамку (pad со всех сторон)', () => {
    const geometry = sparklineGeometry([5, 500, 0, 250, null, 90, 91]);
    expect(geometry).not.toBeNull();
    const coords = (geometry as NonNullable<typeof geometry>).line
      .split(/[ML]/)
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => pair.split(' ').map(Number));
    for (const [x, y] of coords) {
      expect(x).toBeGreaterThanOrEqual(SPARKLINE_BOX.pad);
      expect(x).toBeLessThanOrEqual(SPARKLINE_BOX.width - SPARKLINE_BOX.pad);
      expect(y).toBeGreaterThanOrEqual(SPARKLINE_BOX.pad);
      expect(y).toBeLessThanOrEqual(SPARKLINE_BOX.height - SPARKLINE_BOX.pad);
    }
  });

  it('произвольная рамка учитывается в масштабе', () => {
    const geometry = sparklineGeometry([0, 10], { width: 10, height: 10, pad: 1 });
    expect(geometry?.line).toBe('M 1 9 L 9 1');
  });
});
