import type { FaqItem } from '@/content/faq';
import type { District } from '@/lib/districts';

/**
 * JSON-LD структурированные данные (schema.org) для поисковиков.
 *
 * Сериализуются ТОЛЬКО наши статические данные (контент из src/content,
 * координаты районов из OSM) — пользовательский ввод сюда не попадает.
 * «<» всё равно экранируем: даже теоретическая подстрока «</script>»
 * не должна разорвать тег.
 */

/** Канонический origin сайта (без завершающего слэша). */
export const SITE_URL = 'https://almaty-air-two.vercel.app';

const SITE_NAME = 'Воздух Алматы';

/** Узел JSON-LD верхнего уровня: @context и @type обязательны. */
export interface JsonLdNode {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

/** Главная: сайт как таковой. */
export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'ru',
    description:
      'Качество воздуха в Алматы: индекс AQI по восьми районам, PM2.5 и PM10, история и рекомендации.',
  };
}

/** Главная: сайт как бесплатное веб-приложение (PWA). */
export function webApplicationJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'ru',
    // Категории «Weather» в перечне schema.org нет; ближайшая честная
    // для мониторинга воздуха — UtilitiesApplication.
    applicationCategory: 'UtilitiesApplication',
    browserRequirements: 'Requires JavaScript',
    operatingSystem: 'Any',
    isAccessibleForFree: true,
  };
}

/** Главная: FAQPage из тех же данных, что и видимый аккордеон FaqSection. */
export function faqPageJsonLd(items: readonly FaqItem[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'ru',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** Страница района: хлебные крошки «Главная → район». */
export function districtBreadcrumbsJsonLd(district: District): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Главная',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: district.nameRu,
        item: `${SITE_URL}/district/${district.slug}`,
      },
    ],
  };
}

/** Страница района: район как место с координатами центроида (из OSM). */
export function districtPlaceJsonLd(district: District): JsonLdNode {
  const [latitude, longitude] = district.centroid;
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: district.nameRu,
    url: `${SITE_URL}/district/${district.slug}`,
    containedInPlace: { '@type': 'City', name: 'Алматы' },
    geo: {
      '@type': 'GeoCoordinates',
      // 5 знаков ≈ 1 м — достаточно, без лишних 15 знаков после запятой.
      latitude: Number(latitude.toFixed(5)),
      longitude: Number(longitude.toFixed(5)),
    },
  };
}

/** Страница «О проекте»: методология с указанием автора. */
export function aboutPageJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Как мы считаем качество воздуха',
    url: `${SITE_URL}/about`,
    inLanguage: 'ru',
    author: {
      '@type': 'Person',
      name: 'Alexander Kurchakov',
      url: 'https://github.com/Alexanderadon',
    },
    about: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` },
  };
}
