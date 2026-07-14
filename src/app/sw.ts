/// <reference lib="webworker" />
/**
 * Сервис-воркер «Воздух Алматы» (Serwist 9, InjectManifest через @serwist/next).
 *
 * Стратегии:
 * - /api/* — только сеть (данные о воздухе не должны отдаваться из кэша SW,
 *   свежесть контролирует сам API);
 * - тайлы OpenStreetMap — CacheFirst с ограничением по количеству и возрасту;
 * - статика Next (/_next/static, /_next/image) — CacheFirst;
 * - навигации по страницам — NetworkFirst с откатом в кэш офлайн.
 *
 * Плюс обработчики Web Push: показ уведомления из JSON-пейлоада
 * {title, body, url, tag} и фокус/открытие вкладки по клику.
 *
 * Директива `reference lib="webworker"` добавляет типы SW к этому файлу;
 * конфликтующие с lib.dom объявления гасятся skipLibCheck (рекомендация Serwist).
 */
import { parsePushPayload, type PushPayload } from "@/lib/push-payload";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY_SECONDS = 24 * 60 * 60;

const runtimeCaching: RuntimeCaching[] = [
  // API — всегда сеть, без кэширования в SW.
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // Тайлы карты OSM: кросс-доменные, ответы могут быть opaque (status 0).
  {
    matcher: ({ url }) =>
      url.hostname === "tile.openstreetmap.org" ||
      url.hostname.endsWith(".tile.openstreetmap.org"),
    handler: new CacheFirst({
      cacheName: "osm-tiles",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 7 * DAY_SECONDS,
        }),
      ],
    }),
  },
  // Статика Next: хэшированные ассеты и оптимизированные изображения.
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin &&
      (url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/_next/image")),
    handler: new CacheFirst({
      cacheName: "next-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * DAY_SECONDS,
        }),
      ],
    }),
  },
  // Страницы: сначала сеть, при недоступности — последняя закэшированная версия.
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 10,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let parsed: unknown;
  try {
    parsed = event.data.json();
  } catch {
    // Не-JSON пейлоад — игнорируем, фейковых уведомлений не показываем.
    return;
  }

  // JSON-литерал `null` (или число/строка) парсится без исключения, но чтение
  // payload.title на нём бросало бы TypeError уже вне try/catch — и уведомление
  // молча не показывалось бы. Не-объект — не наш пейлоад, игнорируем.
  const payload: PushPayload | null = parsePushPayload(parsed);
  if (payload === null) return;

  const title = payload.title ?? "Воздух Алматы";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data as { url?: string } | undefined;
  const targetUrl = new URL(data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Уже открытая вкладка с нужным URL — просто фокус.
      const exact = windows.find((client) => client.url === targetUrl);
      if (exact) {
        return exact.focus();
      }
      // Любая открытая вкладка приложения — фокус и переход.
      const [first] = windows;
      if (first) {
        const focused = await first.focus();
        return focused.navigate(targetUrl);
      }
      // Вкладок нет — открываем новую.
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
