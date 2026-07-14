import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SiteHeader } from '@/components/ui/SiteHeader';
import { SiteFooter } from '@/components/ui/SiteFooter';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://almaty-air-two.vercel.app'),
  title: {
    default: 'Воздух Алматы — качество воздуха в реальном времени',
    template: '%s — Воздух Алматы',
  },
  description:
    'Качество воздуха в Алматы по районам: индекс AQI, концентрации PM2.5 и PM10, история изменений и практические рекомендации. Данные станций мониторинга и модели CAMS (Copernicus).',
  openGraph: {
    title: 'Воздух Алматы — качество воздуха в реальном времени',
    description:
      'Индекс AQI, PM2.5 и PM10 по восьми районам Алматы: карта, история и рекомендации.',
    siteName: 'Воздух Алматы',
    locale: 'ru_RU',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#101216' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full`}>
      <body className="flex min-h-dvh flex-col bg-surface font-sans text-foreground antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          К основному содержимому
        </a>
        <SiteHeader />
        <div id="content" className="flex flex-1 flex-col">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
