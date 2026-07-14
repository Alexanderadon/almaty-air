/**
 * Тесты чистых хелперов темы: разбор значения из localStorage,
 * цикл переключателя и маппинг предпочтения на атрибут data-theme.
 */

import { describe, expect, it } from 'vitest';
import {
  nextTheme,
  parseStoredTheme,
  themeDataAttribute,
  type ThemePreference,
} from '../theme';

describe('parseStoredTheme', () => {
  it('возвращает явные light и dark как есть', () => {
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('dark')).toBe('dark');
  });

  it('всё остальное — системная тема (null, мусор, регистр)', () => {
    expect(parseStoredTheme(null)).toBe('system');
    expect(parseStoredTheme('')).toBe('system');
    expect(parseStoredTheme('system')).toBe('system');
    expect(parseStoredTheme('DARK')).toBe('system');
    expect(parseStoredTheme('auto')).toBe('system');
  });
});

describe('nextTheme', () => {
  it('перебирает системная → светлая → тёмная → системная', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('полный цикл возвращается в исходное состояние за три шага', () => {
    const start: ThemePreference = 'system';
    expect(nextTheme(nextTheme(nextTheme(start)))).toBe(start);
  });
});

describe('themeDataAttribute', () => {
  it('системная тема — атрибут снимается (null)', () => {
    expect(themeDataAttribute('system')).toBeNull();
  });

  it('ручной выбор — значение атрибута как есть', () => {
    expect(themeDataAttribute('light')).toBe('light');
    expect(themeDataAttribute('dark')).toBe('dark');
  });
});
