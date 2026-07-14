/**
 * Тема оформления: пользовательское предпочтение поверх системной.
 *
 * Модель из трёх состояний:
 * - 'system' — атрибут data-theme на <html> отсутствует, работает
 *   @media (prefers-color-scheme: dark) в globals.css;
 * - 'light' / 'dark' — html[data-theme=…] принудительно включает палитру
 *   независимо от настроек ОС.
 *
 * Выбор хранится в localStorage и применяется до первой отрисовки
 * инлайн-скриптом в layout.tsx (см. THEME_INIT_SCRIPT-комментарий там).
 */

export type ThemePreference = 'system' | 'light' | 'dark';

/** Ключ localStorage с выбранной темой ('light' | 'dark'; отсутствие = системная). */
export const THEME_STORAGE_KEY = 'almaty-air-theme';

/** Порядок перебора кнопкой-переключателем. */
const CYCLE: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * Разбирает сырое значение из localStorage.
 * Всё, кроме явных 'light' и 'dark' (null, мусор, старые форматы), —
 * системная тема: безопасный фолбэк без выброса исключений.
 */
export function parseStoredTheme(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** Следующее состояние цикла: системная → светлая → тёмная → системная. */
export function nextTheme(current: ThemePreference): ThemePreference {
  const index = CYCLE.indexOf(current);
  return CYCLE[(index + 1) % CYCLE.length];
}

/**
 * Значение data-theme для <html>: null = атрибут снять (системная тема),
 * иначе — принудительная палитра.
 */
export function themeDataAttribute(
  preference: ThemePreference,
): 'light' | 'dark' | null {
  return preference === 'system' ? null : preference;
}
