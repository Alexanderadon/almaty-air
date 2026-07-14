'use client';

import { useCallback, useEffect, useState } from 'react';

/** Ключ localStorage: подсказка скрыта пользователем навсегда. */
const DISMISS_KEY = 'almaty-air-install-hint-dismissed';

/** Нестандартизованное событие Chromium; в lib.dom его типа нет. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Безопасный matchMedia: в старых WebView и jsdom его может не быть. */
function mediaMatches(query: string): boolean {
  return (
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  );
}

/** Приложение уже открыто как установленное (standalone). */
function isStandalone(): boolean {
  if (mediaMatches('(display-mode: standalone)')) return true;
  // iOS Safari: нестандартный navigator.standalone.
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  );
}

/** iPhone/iPod/iPad, включая iPadOS, который маскируется под Mac. */
function isIos(): boolean {
  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return ua.includes('Macintosh') && window.navigator.maxTouchPoints > 1;
}

type HintMode = 'hidden' | 'ios' | 'install';

/**
 * Ненавязчивая подсказка об установке PWA.
 *
 * Показывается только вне standalone-режима и пока не скрыта пользователем:
 * - iOS Safari (там нет beforeinstallprompt) — текстовая инструкция;
 * - прочие мобильные — кнопка «Установить приложение», когда браузер
 *   прислал beforeinstallprompt.
 */
export function InstallHint() {
  const [mode, setMode] = useState<HintMode>('hidden');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Приватный режим без localStorage — не рискуем показывать навсегда.
      return;
    }

    if (isIos()) {
      // Показ только после монтирования — осознанно: сервер рендерит null,
      // а вычисление в инициализаторе useState дало бы hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('ios');
      return;
    }

    // Не iOS: подсказка уместна только на сенсорных устройствах.
    if (!mediaMatches('(pointer: coarse)')) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode('install');
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setMode('hidden');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Недоступный localStorage — скрываем хотя бы до перезагрузки.
    }
    setMode('hidden');
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    setDeferredPrompt(null);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // Браузер отклонил повторный prompt — просто скрываем подсказку.
    }
    // Независимо от выбора прячем подсказку в этой сессии (без записи
    // в localStorage: пользователь мог передумать, покажем в следующий раз).
    setMode('hidden');
  }, [deferredPrompt]);

  if (mode === 'hidden') return null;

  return (
    <aside
      aria-label="Установка приложения"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Установите приложение</p>
          {mode === 'ios' ? (
            <p className="mt-1 text-sm text-muted">
              В Safari нажмите «Поделиться», затем выберите «На экран
              „Домой“» — приложение будет открываться с главного экрана.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Быстрый доступ с главного экрана и работа офлайн.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-card transition-opacity hover:opacity-90"
              >
                Установить приложение
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть подсказку об установке"
          className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:text-foreground"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 3 L13 13 M13 3 L3 13" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
