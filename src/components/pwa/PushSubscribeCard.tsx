'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribeToDistrict, unsubscribe } from '@/app/district/[slug]/actions';
import type { DistrictSlug } from '@/lib/types';

/** Ключ localStorage: район, на который оформлена push-подписка этого браузера. */
const SUBSCRIBED_DISTRICT_KEY = 'almaty-air-push-district';

/** VAPID-ключ инлайнится при сборке; без него подписка невозможна — карточка скрыта. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** applicationServerKey для pushManager.subscribe: base64url → Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** iPhone/iPod/iPad, включая iPadOS под маской Mac (см. InstallHint). */
function isIos(): boolean {
  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return ua.includes('Macintosh') && window.navigator.maxTouchPoints > 1;
}

/** Открыто как установленное приложение (standalone). */
function isStandalone(): boolean {
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true;
  }
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readSubscribedDistrict(): string | null {
  try {
    return window.localStorage.getItem(SUBSCRIBED_DISTRICT_KEY);
  } catch {
    return null;
  }
}

function writeSubscribedDistrict(slug: string | null): void {
  try {
    if (slug === null) window.localStorage.removeItem(SUBSCRIBED_DISTRICT_KEY);
    else window.localStorage.setItem(SUBSCRIBED_DISTRICT_KEY, slug);
  } catch {
    // Приватный режим без localStorage — статус доживёт до перезагрузки.
  }
}

/** Регистрация SW с таймаутом: в dev SW отключён, ready никогда не резолвится. */
async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('service worker не зарегистрирован')), 8000);
    }),
  ]);
}

type CardStatus =
  | 'hidden' // нет поддержки push / нет VAPID-ключа / до гидрации
  | 'ios-hint' // iOS вне standalone: push доступен только установленному приложению
  | 'idle' // можно подписаться
  | 'busy' // идёт подписка/отписка
  | 'subscribed' // подписка на ЭТОТ район активна
  | 'denied' // уведомления заблокированы в браузере
  | 'error'; // сбой подписки/отписки

/**
 * Начальное состояние карточки после гидрации. null — карточку не показывать.
 * Вынесено из эффекта, чтобы setState вызывался асинхронно (после await).
 */
async function detectInitialStatus(slug: DistrictSlug): Promise<CardStatus | null> {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) {
    // iOS 16.4+ даёт Web Push только приложению с экрана «Домой».
    return isIos() && !isStandalone() ? 'ios-hint' : null;
  }
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;
    // Подписка есть, но на другой район — предлагаем переключиться (idle).
    const active = subscription !== null && readSubscribedDistrict() === slug;
    return active ? 'subscribed' : 'idle';
  } catch {
    return 'idle';
  }
}

export interface PushSubscribeCardProps {
  slug: DistrictSlug;
  className?: string;
}

/**
 * Карточка push-уведомлений на странице района.
 *
 * До гидрации и на неподдерживаемых браузерах не рендерится. На iOS вне
 * standalone показывает подсказку об установке (Web Push на iOS 16.4+
 * доступен только приложению с экрана «Домой»). Подписка одна на браузер:
 * подписка из другого района переключает район (upsert по endpoint).
 */
export function PushSubscribeCard({ slug, className = '' }: PushSubscribeCardProps) {
  const [status, setStatus] = useState<CardStatus>('hidden');

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;

    let cancelled = false;
    void (async () => {
      const next = await detectInitialStatus(slug);
      if (!cancelled && next !== null) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return;
    setStatus('busy');
    try {
      // requestPermission — первым делом, пока жив пользовательский жест.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const registration = await serviceWorkerRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const result = await subscribeToDistrict(slug, subscription.toJSON());
      if (!result.ok) {
        setStatus('error');
        return;
      }
      writeSubscribedDistrict(slug);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }, [slug]);

  const disable = useCallback(async () => {
    setStatus('busy');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;
      if (subscription) {
        // Сервер требует полную подписку (endpoint + ключи) как доказательство
        // владения — знания одного endpoint'а для отписки недостаточно.
        await unsubscribe(subscription.toJSON());
        await subscription.unsubscribe();
      }
      writeSubscribedDistrict(null);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  if (status === 'hidden') return null;

  return (
    <section
      aria-label="Push-уведомления о качестве воздуха"
      className={`rounded-2xl border border-border bg-card p-5 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Уведомления
      </p>

      {status === 'ios-hint' && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Установите приложение на экран «Домой», чтобы получать уведомления.
        </p>
      )}

      {status === 'denied' && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Уведомления для этого сайта заблокированы в браузере. Чтобы включить
          их, откройте настройки сайта (значок рядом с адресной строкой) и
          разрешите уведомления, затем обновите страницу.
        </p>
      )}

      {status === 'error' && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Не удалось настроить уведомления. Проверьте соединение и попробуйте
            ещё раз.
          </p>
          <button
            type="button"
            onClick={subscribe}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-card transition-opacity hover:opacity-90"
          >
            Попробовать ещё раз
          </button>
        </>
      )}

      {(status === 'idle' || status === 'busy') && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Пришлём push-уведомление, когда AQI в этом районе поднимется до
            уровня «Вредно для чувствительных» и выше.
          </p>
          <button
            type="button"
            onClick={subscribe}
            disabled={status === 'busy'}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === 'busy' ? 'Подключаем…' : 'Сообщать, когда воздух станет вредным'}
          </button>
        </>
      )}

      {status === 'subscribed' && (
        <>
          <p className="mt-1.5 text-sm font-semibold">Уведомления включены</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Сообщим, когда воздух в районе станет вредным.
          </p>
          <button
            type="button"
            onClick={disable}
            className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Отписаться
          </button>
        </>
      )}
    </section>
  );
}
