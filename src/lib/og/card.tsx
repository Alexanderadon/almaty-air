/**
 * Общий рендер OG-карточек (главная и районы): тёмная карточка 1200×630 —
 * сверху крупный AQI с категорией по-русски, внизу ночная low-poly-сцена
 * Заилийского Алатау (та же, что в герое главной), смог в которой плотнеет
 * с ростом индекса. Без градиентов: фон плоский, свечения нет.
 *
 * Только inline-стили — satori (next/og) не понимает классы Tailwind.
 * Кириллица требует своего шрифта (см. ./fonts): если шрифт не загрузился,
 * карточка честно деградирует до латинского минимума (цифры + домен),
 * а не рисует тофу вместо русского текста.
 */

import { ImageResponse } from 'next/og';
import { aqiCategory } from '../aqi';
import { loadGoogleFont } from './fonts';
import { legibleOnDark } from './palette';
import { OG_SCENE_COLORS, ogSceneDataUri } from './scene';

export const OG_SIZE = { width: 1200, height: 630 };

/** Высота сцены внизу карточки; текст живёт над ней (и над её небом). */
const SCENE_HEIGHT = 300;

const SITE_HOST = 'almaty-air-two.vercel.app';
const FOOTER_TEXT = `AQI (US EPA 2024) · ${SITE_HOST}`;
const NO_DATA_TEXT = 'Данные временно недоступны';

/** Акцент для карточки без данных: нейтральный серо-голубой. */
const NEUTRAL_ACCENT = '#5B6472';

const BG = OG_SCENE_COLORS.sky;
const TEXT_PRIMARY = '#F4F5F7';
const TEXT_MUTED = '#8E97A5';

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
}

export interface AqiOgCardProps {
  /** Надзаголовок (для районов — «Воздух Алматы»); рендерится капителью. */
  eyebrow?: string;
  /** Заголовок: «Воздух Алматы» на главной, имя района на страницах районов. */
  title: string;
  /** Текущий AQI; null — карточка без чисел (без выдуманных значений). */
  aqi: number | null;
}

export async function renderAqiOgCard(props: AqiOgCardProps): Promise<ImageResponse> {
  const { title, aqi } = props;
  const eyebrow = props.eyebrow?.toUpperCase();
  const category = aqi !== null ? aqiCategory(aqi) : null;
  const numberColor = legibleOnDark(category ? category.color : NEUTRAL_ACCENT);

  // Субсет по фактическому тексту карточки (+ цифры на все значения AQI).
  const cardText = [eyebrow ?? '', title, category?.labelRu ?? NO_DATA_TEXT, FOOTER_TEXT, '0123456789'].join('');
  const [regular, bold] = await Promise.all([
    loadGoogleFont('Inter', 400, cardText),
    loadGoogleFont('Inter', 700, cardText),
  ]);
  const fonts: OgFont[] = [];
  if (regular) fonts.push({ name: 'Inter', data: regular, weight: 400, style: 'normal' });
  if (bold) fonts.push({ name: 'Inter', data: bold, weight: 700, style: 'normal' });

  // Без кириллического шрифта satori отрисует тофу — оставляем латинский минимум.
  const cyrillicReady = fonts.length > 0;

  const card = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: BG,
        color: TEXT_PRIMARY,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Сцена прижата к низу; её небо того же цвета, что фон карточки — шва нет.
          Готовая SVG-строка через data-URI: satori растрирует её как картинку.
          Это не страница, а рендер PNG в satori — next/image здесь неприменим. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogSceneDataUri(OG_SIZE.width, SCENE_HEIGHT, aqi)}
        width={OG_SIZE.width}
        height={SCENE_HEIGHT}
        alt=""
        style={{ position: 'absolute', left: 0, bottom: 0 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 64px 0' }}>
        {cyrillicReady && eyebrow ? (
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '0.16em',
              color: TEXT_MUTED,
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {cyrillicReady ? title : SITE_HOST}
        </div>

        {aqi !== null && category ? (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 168,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: numberColor,
              }}
            >
              {String(aqi)}
            </div>
            {cyrillicReady ? (
              <div
                style={{
                  display: 'flex',
                  marginLeft: 32,
                  marginTop: 22,
                  padding: '12px 32px',
                  borderRadius: 999,
                  backgroundColor: category.color,
                  color: category.textColor,
                  fontSize: 34,
                  fontWeight: 700,
                }}
              >
                {category.labelRu}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  marginLeft: 32,
                  width: 240,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: category.color,
                }}
              />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', marginTop: 40, fontSize: 44, fontWeight: 400, color: TEXT_MUTED }}>
            {cyrillicReady ? NO_DATA_TEXT : '—'}
          </div>
        )}

        <div style={{ display: 'flex', marginTop: 10, fontSize: 24, fontWeight: 400, color: TEXT_MUTED }}>
          {FOOTER_TEXT}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(card, {
    ...OG_SIZE,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}
