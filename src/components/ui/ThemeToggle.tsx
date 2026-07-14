'use client';

import { useEffect, useState } from 'react';
import {
  THEME_STORAGE_KEY,
  nextTheme,
  parseStoredTheme,
  themeDataAttribute,
  type ThemePreference,
} from '@/lib/theme';

const LABEL: Record<ThemePreference, string> = {
  system: 'Тема: системная',
  light: 'Тема: светлая',
  dark: 'Тема: тёмная',
};

/** Применяет предпочтение к <html>: data-theme или его отсутствие (системная). */
function applyTheme(preference: ThemePreference) {
  const value = themeDataAttribute(preference);
  if (value === null) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
}

/** Сохраняет выбор; системная тема = отсутствие ключа. */
function persistTheme(preference: ThemePreference) {
  try {
    if (preference === 'system')
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Приватный режим без localStorage — тема доживёт до перезагрузки.
  }
}

/** Иконки состояний: монитор (системная), солнце, месяц. Всё — currentColor. */
function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = {
    viewBox: '0 0 16 16',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;

  if (preference === 'light') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.2v1.6M8 13.2v1.6M14.8 8h-1.6M2.8 8H1.2M12.8 3.2l-1.13 1.13M4.33 11.67 3.2 12.8M12.8 12.8l-1.13-1.13M4.33 4.33 3.2 3.2" />
      </svg>
    );
  }
  if (preference === 'dark') {
    return (
      <svg {...common}>
        <path d="M13.5 9.7A5.5 5.5 0 0 1 6.3 2.5a5.5 5.5 0 1 0 7.2 7.2Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="1.8" y="2.8" width="12.4" height="8.4" rx="1.5" />
      <path d="M6 13.8h4M8 11.2v2.6" />
    </svg>
  );
}

/**
 * Переключатель темы в шапке: одна кнопка перебирает
 * системная → светлая → тёмная.
 *
 * До монтирования рендерится нейтральное состояние «системная» — сервер не
 * знает выбор из localStorage, а одинаковый первый рендер на сервере и
 * клиенте исключает hydration mismatch. Сам атрибут data-theme к этому
 * моменту уже выставлен инлайн-скриптом в layout.tsx, поэтому вспышки
 * не той темы нет — после монтирования догоняет только иконка.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  // Анимация смены иконки — только после клика, не на загрузке страницы.
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Приватный режим — остаёмся на системной.
    }
    // Чтение localStorage возможно только на клиенте — осознанный setState
    // после монтирования (тот же паттерн, что в InstallHint).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(parseStoredTheme(stored));
  }, []);

  const cycle = () => {
    const next = nextTheme(theme ?? 'system');
    applyTheme(next);
    persistTheme(next);
    setTheme(next);
    setInteracted(true);
  };

  const current = theme ?? 'system';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={LABEL[current]}
      title="Переключить тему"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-card hover:text-foreground"
    >
      {/* key перемонтирует иконку при смене — запускает theme-icon-in.
          inline-flex обязателен: transform не работает на inline-элементах. */}
      <span
        key={current}
        className={`inline-flex${interacted ? ' theme-icon-enter' : ''}`}
      >
        <ThemeIcon preference={current} />
      </span>
      {/* Смену состояния озвучиваем скринридерам явно: на смену aria-label
          у кнопки в фокусе полагаться нельзя (паттерн из ShareButton). */}
      <span role="status" className="sr-only">
        {interacted ? LABEL[current] : ''}
      </span>
    </button>
  );
}
