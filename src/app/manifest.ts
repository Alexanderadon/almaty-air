import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (Next-конвенция app/manifest.ts → /manifest.webmanifest).
 *
 * Цвета согласованы с дизайн-токенами globals.css: --surface светлой темы
 * #F7F7F4 (manifest не умеет реагировать на prefers-color-scheme, поэтому
 * берём светлый вариант как базовый).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Воздух Алматы',
    short_name: 'Воздух',
    description:
      'Качество воздуха в Алматы по районам: индекс AQI, концентрации PM2.5 и PM10, история изменений и практические рекомендации.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'ru',
    dir: 'ltr',
    background_color: '#F7F7F4',
    theme_color: '#F7F7F4',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
