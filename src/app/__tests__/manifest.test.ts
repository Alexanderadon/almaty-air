/**
 * Тесты Web App Manifest: обязательные для установки PWA поля,
 * русская локаль и полный набор иконок (192 + 512 + maskable).
 */

import { describe, expect, it } from 'vitest';
import manifest from '../manifest';

describe('manifest', () => {
  const m = manifest();

  it('содержит обязательные для установки поля', () => {
    expect(m.name).toBe('Воздух Алматы');
    expect(m.short_name).toBe('Воздух');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.lang).toBe('ru');
  });

  it('цвета совпадают с токенами светлой темы globals.css', () => {
    expect(m.background_color).toBe('#F7F7F4');
    expect(m.theme_color).toBe('#F7F7F4');
  });

  it('иконки: 192, 512 и maskable 512', () => {
    const icons = m.icons ?? [];
    const bySize = (size: string) => icons.filter((i) => i.sizes === size);
    expect(bySize('192x192')).toHaveLength(1);
    expect(bySize('512x512')).toHaveLength(2);
    const maskable = icons.find((i) => i.purpose === 'maskable');
    expect(maskable?.sizes).toBe('512x512');
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith('/icons/')).toBe(true);
    }
  });
});
