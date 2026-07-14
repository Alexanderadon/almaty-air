import { describe, expect, it } from 'vitest';

import {
  AQI_CATEGORIES,
  aqiCategory,
  median,
  pm10ToAqi,
  pm25ToAqi,
} from '../aqi';

describe('pm25ToAqi — границы сегментов (ревизия EPA 2024)', () => {
  it.each([
    [0, 0],
    [9.0, 50],
    [9.1, 51],
    [35.4, 100],
    [35.5, 101],
    [55.4, 150],
    [55.5, 151],
    [125.4, 200],
    [125.5, 201],
    [225.4, 300],
    [225.5, 301],
    [325.4, 500],
  ])('%f мкг/м³ → AQI %i', (conc, aqi) => {
    expect(pm25ToAqi(conc)).toBe(aqi);
  });

  it('концентрации выше верхнего брейкпоинта прижимаются к 500', () => {
    expect(pm25ToAqi(325.5)).toBe(500);
    expect(pm25ToAqi(400)).toBe(500);
    expect(pm25ToAqi(10_000)).toBe(500);
  });

  it('интерполяция внутри сегмента', () => {
    // (100-51)/(35.4-9.1)*(12.0-9.1)+51 = 56.403 → 56
    expect(pm25ToAqi(12)).toBe(56);
    // (150-101)/(55.4-35.5)*(35.9-35.5)+101 = 101.98 → 102
    expect(pm25ToAqi(35.9)).toBe(102);
  });
});

describe('pm10ToAqi — границы сегментов', () => {
  it.each([
    [0, 0],
    [54, 50],
    [55, 51],
    [154, 100],
    [155, 101],
    [254, 150],
    [255, 151],
    [354, 200],
    [355, 201],
    [424, 300],
    [425, 301],
    [604, 500],
  ])('%i мкг/м³ → AQI %i', (conc, aqi) => {
    expect(pm10ToAqi(conc)).toBe(aqi);
  });

  it('концентрации выше верхнего брейкпоинта прижимаются к 500', () => {
    expect(pm10ToAqi(605)).toBe(500);
    expect(pm10ToAqi(2_000)).toBe(500);
  });

  it('интерполяция внутри сегмента', () => {
    // (100-51)/(154-55)*(100-55)+51 = 73.27 → 73
    expect(pm10ToAqi(100)).toBe(73);
  });
});

describe('усечение концентраций по правилам EPA', () => {
  it('PM2.5 усекается до 0.1 (не округляется)', () => {
    expect(pm25ToAqi(9.04)).toBe(50);
    expect(pm25ToAqi(9.09)).toBe(50); // 9.09 → 9.0, а не 9.1
    expect(pm25ToAqi(35.449)).toBe(100); // 35.449 → 35.4
    expect(pm25ToAqi(35.499)).toBe(100);
  });

  it('PM2.5: двоичное представление 9.1 не «проваливается» в 9.0', () => {
    // 9.1 * 10 === 90.99999999999999 — наивное усечение дало бы AQI 50
    expect(pm25ToAqi(9.1)).toBe(51);
    expect(pm25ToAqi(35.5)).toBe(101);
  });

  it('PM10 усекается до целого', () => {
    expect(pm10ToAqi(54.9)).toBe(50); // 54.9 → 54
    expect(pm10ToAqi(55.7)).toBe(51); // 55.7 → 55
    expect(pm10ToAqi(154.99)).toBe(100); // 154.99 → 154
  });
});

describe('монотонность: рост концентрации не снижает AQI', () => {
  it('PM2.5, шаг 0.1 от 0 до 350', () => {
    let prev = -1;
    for (let i = 0; i <= 3_500; i++) {
      const aqi = pm25ToAqi(i / 10);
      expect(aqi).not.toBeNull();
      expect(aqi as number).toBeGreaterThanOrEqual(prev);
      prev = aqi as number;
    }
  });

  it('PM10, шаг 1 от 0 до 700', () => {
    let prev = -1;
    for (let c = 0; c <= 700; c++) {
      const aqi = pm10ToAqi(c);
      expect(aqi).not.toBeNull();
      expect(aqi as number).toBeGreaterThanOrEqual(prev);
      prev = aqi as number;
    }
  });
});

describe('невалидные входы → null', () => {
  it.each([[-0.1], [-5], [Number.NaN], [Infinity], [-Infinity]])(
    'pm25ToAqi(%f) === null',
    (v) => {
      expect(pm25ToAqi(v)).toBeNull();
    },
  );

  it.each([[-1], [Number.NaN], [Infinity], [-Infinity]])(
    'pm10ToAqi(%f) === null',
    (v) => {
      expect(pm10ToAqi(v)).toBeNull();
    },
  );
});

describe('aqiCategory — границы категорий', () => {
  it.each([
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'usg'],
    [150, 'usg'],
    [151, 'unhealthy'],
    [200, 'unhealthy'],
    [201, 'very-unhealthy'],
    [300, 'very-unhealthy'],
    [301, 'hazardous'],
    [500, 'hazardous'],
  ])('AQI %i → %s', (aqi, key) => {
    expect(aqiCategory(aqi).key).toBe(key);
  });

  it('значения вне шкалы прижимаются к краям', () => {
    expect(aqiCategory(-5).key).toBe('good');
    expect(aqiCategory(501).key).toBe('hazardous');
    expect(aqiCategory(9_999).key).toBe('hazardous');
  });
});

describe('AQI_CATEGORIES — структура', () => {
  it('шесть категорий в порядке возрастания опасности', () => {
    expect(AQI_CATEGORIES.map((c) => c.key)).toEqual([
      'good',
      'moderate',
      'usg',
      'unhealthy',
      'very-unhealthy',
      'hazardous',
    ]);
  });

  it('диапазоны AQI непрерывны и покрывают 0–500', () => {
    expect(AQI_CATEGORIES[0].aqiRange[0]).toBe(0);
    expect(AQI_CATEGORIES[AQI_CATEGORIES.length - 1].aqiRange[1]).toBe(500);
    for (let i = 1; i < AQI_CATEGORIES.length; i++) {
      expect(AQI_CATEGORIES[i].aqiRange[0]).toBe(
        AQI_CATEGORIES[i - 1].aqiRange[1] + 1,
      );
    }
  });

  it('русские названия категорий', () => {
    expect(AQI_CATEGORIES.map((c) => c.labelRu)).toEqual([
      'Хорошо',
      'Умеренно',
      'Вредно для чувствительных',
      'Вредно',
      'Очень вредно',
      'Опасно',
    ]);
  });

  it('светлота фона монотонно убывает (читаемость в градациях серого)', () => {
    let prev = Infinity;
    for (const cat of AQI_CATEGORIES) {
      const y = relativeLuminance(cat.color);
      expect(y).toBeLessThan(prev);
      prev = y;
    }
  });

  it('контраст текста над фоном ≥ 4.5:1 (WCAG AA) в каждой категории', () => {
    for (const cat of AQI_CATEGORIES) {
      expect(contrastRatio(cat.color, cat.textColor)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe('median', () => {
  it('пустой массив → null', () => {
    expect(median([])).toBeNull();
  });

  it('один элемент', () => {
    expect(median([7])).toBe(7);
  });

  it('нечётное количество — средний элемент', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([9, 1, 5, 3, 7])).toBe(5);
  });

  it('чётное количество — среднее двух центральных', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([10, 20])).toBe(15);
  });

  it('NaN и бесконечности игнорируются', () => {
    expect(median([Number.NaN])).toBeNull();
    expect(median([1, Number.NaN, 3])).toBe(2);
    expect(median([Infinity, -Infinity])).toBeNull();
  });

  it('не мутирует входной массив', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

/* --- WCAG 2.x: относительная светлота и коэффициент контраста --- */

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (offset: number): number => {
    const c = parseInt(h.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
