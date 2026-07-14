import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/seo/JsonLd';
import { DISTRICT_SLUGS } from '@/lib/types';

/**
 * sitemap.xml: главная, 8 районов, «О проекте».
 *
 * Генерируется статически при сборке, поэтому lastModified — время билда;
 * данные страниц и так пересобираются ISR раз в час (changeFrequency hourly).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'hourly',
      priority: 1,
    },
    ...DISTRICT_SLUGS.map((slug) => ({
      url: `${SITE_URL}/district/${slug}`,
      lastModified,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
