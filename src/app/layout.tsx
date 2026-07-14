import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { InstallHint } from '@/components/pwa/InstallHint';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://almaty-air-two.vercel.app'),
  applicationName: 'Воздух Алматы',
  // Ссылку rel="manifest" добавляет файловая конвенция src/app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: 'Воздух',
    statusBarStyle: 'default',
  },
  // Явная конфигурация иконок: при заданном metadata.icons Next не добавляет
  // автоссылку на файловую конвенцию app/icon.svg, поэтому указываем обе.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
  },
  title: {
    default: 'Качество воздуха в Алматы сейчас — AQI по районам, PM2.5',
    template: '%s — Воздух Алматы',
  },
  description:
    'Качество воздуха в Алматы сейчас: индекс AQI по восьми районам, PM2.5 и PM10, графики за 24 часа и 30 дней, рекомендации жителям. Данные станций и модели CAMS.',
  openGraph: {
    title: 'Качество воздуха в Алматы сейчас — AQI по районам, PM2.5',
    description:
      'Индекс AQI, PM2.5 и PM10 по восьми районам Алматы: карта, история и рекомендации.',
    siteName: 'Воздух Алматы',
    locale: 'ru_RU',
    type: 'website',
  },
};

export const viewport: Viewport = {
  // themeColor остаётся media-based: meta[name=theme-color] не умеет
  // реагировать на data-theme без JS. При ручной теме, противоположной
  // системной, цвет статус-бара PWA может не совпасть с фоном — осознанный
  // компромисс (затрагивает только установленное приложение).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#101216' },
  ],
};

/**
 * Применяет сохранённую тему ДО первой отрисовки — без вспышки не той темы.
 * Синхронный инлайн-скрипт первым элементом <body>: App Router не даёт
 * писать в <head> напрямую, а парсер выполнит скрипт до отрисовки контента —
 * эффект тот же (паттерн next-themes). try/catch — приватный режим без
 * localStorage. Ключ и значения — см. src/lib/theme.ts (THEME_STORAGE_KEY).
 */
const THEME_INIT_SCRIPT = `try {
  var t = localStorage.getItem('almaty-air-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT выставляет data-theme на
    // <html> до гидратации — для React это «лишний» атрибут, гасим ложный варнинг.
    <html lang="ru" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-surface font-sans text-foreground antialiased">
        {/* Тема из localStorage — до отрисовки контента (см. THEME_INIT_SCRIPT). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Тайлы OSM грузит Leaflet после гидратации — ранний preconnect
            экономит DNS+TCP+TLS на первом тайле. React 19 поднимает <link> в <head>. */}
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        {/* Ссылка видима ТОЛЬКО при клавиатурном фокусе (:focus-visible).
            Вариант focus: раскрывал её и на programmatic/tap-фокус — на
            мобильных это давало «посторонний прямоугольник» поверх страницы. */}
        <a
          href="#content"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:shadow-lg"
        >
          К основному содержимому
        </a>
        <SiteHeader />
        <div id="content" className="flex flex-1 flex-col">
          {children}
        </div>
        <SiteFooter />
        <InstallHint />
        <Analytics />
      </body>
    </html>
  );
}
