'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ShareButtonProps {
  /** Заголовок для системного диалога «Поделиться», например «Воздух в Медеуском районе: AQI 57». */
  title: string;
  className?: string;
}

type ShareState = 'idle' | 'copied' | 'failed';

const LABEL: Record<ShareState, string> = {
  idle: 'Поделиться',
  copied: 'Ссылка скопирована',
  failed: 'Не удалось скопировать',
};

/** Сколько показывать результат копирования до возврата к «Поделиться». */
const FEEDBACK_MS = 2000;

/**
 * Кнопка «Поделиться» страницей района: системный диалог navigator.share,
 * без его поддержки — копирование ссылки в буфер обмена с подтверждением.
 */
export function ShareButton({ title, className = '' }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const flash = useCallback((next: ShareState) => {
    setState(next);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
  }, []);

  const share = useCallback(async () => {
    const url = window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Пользователь закрыл системный диалог — это не ошибка.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Прочие сбои (NotAllowedError и т.п.) — падаем в копирование ссылки.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flash('copied');
    } catch {
      flash('failed');
    }
  }, [title, flash]);

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12.5" cy="3.5" r="1.9" />
        <circle cx="3.5" cy="8" r="1.9" />
        <circle cx="12.5" cy="12.5" r="1.9" />
        <path d="M5.2 7.1l5.6-2.8M5.2 8.9l5.6 2.8" />
      </svg>
      {LABEL[state]}
      {/* Результат копирования — скринридерам, aria-live на смену текста кнопки не полагаемся. */}
      <span role="status" className="sr-only">
        {state === 'idle' ? '' : LABEL[state]}
      </span>
    </button>
  );
}
