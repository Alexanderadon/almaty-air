import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/seo/JsonLd';

/** robots.txt: индексировать всё, кроме служебного API; ссылка на sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
