import { describe, expect, it } from 'vitest';

import { DISTRICTS, type District } from '@/lib/districts';
import {
  BADGE_NO_DATA_BG,
  badgeHtml,
  escapeHtml,
  nearestDistrict,
} from '../helpers';

describe('escapeHtml', () => {
  it('экранирует все пять спецсимволов HTML', () => {
    expect(escapeHtml(`<a href="x" data-y='&'>`)).toBe(
      '&lt;a href=&quot;x&quot; data-y=&#39;&amp;&#39;&gt;',
    );
  });

  it('обычный русский текст не меняет', () => {
    expect(escapeHtml('Медеуский район')).toBe('Медеуский район');
  });

  it('амперсанд экранирует первым — без двойного экранирования', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('badgeHtml', () => {
  it('aqi=null — серая пилюля с «—»', () => {
    const html = badgeHtml(null, 'Алатауский район');
    expect(html).toContain('—');
    expect(html).toContain(BADGE_NO_DATA_BG);
    expect(html).toContain('данных пока нет');
  });

  it('aqi=42 — число и цвета категории «Хорошо»', () => {
    const html = badgeHtml(42, 'Алмалинский район');
    expect(html).toContain('>42</span>');
    expect(html).toContain('background:#F5F0BB');
    expect(html).toContain('color:#3D3808');
    expect(html).toContain('Хорошо');
  });

  it('aqi=160 — цвета категории «Вредно»', () => {
    const html = badgeHtml(160, 'Турксибский район');
    expect(html).toContain('>160</span>');
    expect(html).toContain('background:#C0503F');
  });

  it('дробный AQI округляется до целого', () => {
    expect(badgeHtml(87.5, 'Жетысуский район')).toContain('>88</span>');
  });

  it('nameRu экранируется — разметка не «протекает» в HTML иконки', () => {
    const html = badgeHtml(50, '<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('nearestDistrict', () => {
  it('центроид каждого района — ближайший к самому себе', () => {
    for (const district of DISTRICTS) {
      const [lat, lon] = district.centroid;
      expect(nearestDistrict(lat, lon).slug, district.slug).toBe(district.slug);
    }
  });

  it('точка чуть в стороне от центроида остаётся с тем же районом', () => {
    const medeu = DISTRICTS.find((d) => d.slug === 'medeu') as District;
    const [lat, lon] = medeu.centroid;
    expect(nearestDistrict(lat + 0.002, lon - 0.002).slug).toBe('medeu');
  });

  it('выбирает более близкий центроид из переданного списка', () => {
    const fake: District[] = [
      { slug: 'almaly', nameRu: 'А', osmRelationId: 1, centroid: [43.0, 76.0] },
      { slug: 'medeu', nameRu: 'Б', osmRelationId: 2, centroid: [43.5, 77.0] },
    ];
    expect(nearestDistrict(43.05, 76.1, fake).slug).toBe('almaly');
    expect(nearestDistrict(43.45, 76.9, fake).slug).toBe('medeu');
  });

  it('пустой список районов — ошибка', () => {
    expect(() => nearestDistrict(43.2, 76.9, [])).toThrow();
  });
});
