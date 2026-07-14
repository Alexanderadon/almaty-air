/**
 * Тесты утилит OG-карточек: цветовые помощники (читаемость AQI-палитры
 * на тёмном фоне) и разбор ответа Google Fonts CSS API.
 */

import { describe, expect, it } from 'vitest';

import { AQI_CATEGORIES } from '../../aqi';
import { extractFontUrl } from '../fonts';
import { hexToRgb, hexToRgba, legibleOnDark, perceivedLuma } from '../palette';

describe('hexToRgb / hexToRgba', () => {
  it('разбирает #RRGGBB в каналы', () => {
    expect(hexToRgb('#4A1D4F')).toEqual([74, 29, 79]);
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
  });

  it('бросает на неожиданном формате (короткий hex, не-hex)', () => {
    expect(() => hexToRgb('#fff')).toThrow();
    expect(() => hexToRgb('tomato')).toThrow();
  });

  it('строит rgba-строку для градиентов satori', () => {
    expect(hexToRgba('#4A1D4F', 0.3)).toBe('rgba(74, 29, 79, 0.3)');
    expect(hexToRgba('#0F1115', 0)).toBe('rgba(15, 17, 21, 0)');
  });
});

describe('legibleOnDark', () => {
  it('светлые цвета возвращает без изменений', () => {
    expect(legibleOnDark('#F5F0BB')).toBe('#F5F0BB'); // «Хорошо»
    expect(legibleOnDark('#F2C94C')).toBe('#F2C94C'); // «Умеренно»
  });

  it('тёмные цвета осветляет (каждый канал не убывает)', () => {
    const source = hexToRgb('#4A1D4F'); // «Опасно» — слишком тёмный для текста
    const result = hexToRgb(legibleOnDark('#4A1D4F'));
    expect(legibleOnDark('#4A1D4F')).not.toBe('#4A1D4F');
    for (let i = 0; i < 3; i += 1) {
      expect(result[i]).toBeGreaterThan(source[i]);
    }
  });

  it('вся палитра категорий AQI после осветления читаема на тёмном фоне (светлота ≥ 0.5)', () => {
    for (const category of AQI_CATEGORIES) {
      const luma = perceivedLuma(legibleOnDark(category.color));
      expect(luma, `категория ${category.key}`).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('extractFontUrl', () => {
  it('достаёт URL truetype-файла из ответа Google Fonts', () => {
    const css = [
      '@font-face {',
      "  font-family: 'Inter';",
      '  font-style: normal;',
      '  font-weight: 700;',
      "  src: url(https://fonts.gstatic.com/l/font?kit=abc123) format('truetype');",
      '}',
    ].join('\n');
    expect(extractFontUrl(css)).toBe('https://fonts.gstatic.com/l/font?kit=abc123');
  });

  it("принимает и format('opentype')", () => {
    const css = "src: url(https://fonts.gstatic.com/l/font?kit=otf) format('opentype');";
    expect(extractFontUrl(css)).toBe('https://fonts.gstatic.com/l/font?kit=otf');
  });

  it('возвращает null, если TTF/OTF-источника нет (например, отдан только woff2)', () => {
    const css =
      "src: url(https://fonts.gstatic.com/s/inter/v20/x.woff2) format('woff2');";
    expect(extractFontUrl(css)).toBeNull();
  });

  it('возвращает null на пустом CSS', () => {
    expect(extractFontUrl('')).toBeNull();
  });
});
