/**
 * Общий рендер OG-карточек (главная и районы): тёмная карточка 1200×630
 * с крупным AQI, категорией по-русски и подписью шкалы.
 *
 * Только inline-стили — satori (next/og) не понимает классы Tailwind.
 * Кириллица требует своего шрифта (см. ./fonts): если шрифт не загрузился,
 * карточка честно деградирует до латинского минимума (цифры + домен),
 * а не рисует тофу вместо русского текста.
 */

import { ImageResponse } from 'next/og';
import { aqiCategory } from '../aqi';
import { loadGoogleFont } from './fonts';
import { hexToRgba, legibleOnDark } from './palette';

export const OG_SIZE = { width: 1200, height: 630 };

const SITE_HOST = 'almaty-air-two.vercel.app';
const FOOTER_TEXT = `AQI (US EPA 2024) · ${SITE_HOST}`;
const NO_DATA_TEXT = 'Данные временно недоступны';

/** Акцент для карточки без данных: нейтральный серо-голубой. */
const NEUTRAL_ACCENT = '#5B6472';

const BG = '#0F1115';
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
  const accentSource = category ? category.color : NEUTRAL_ACCENT;
  const numberColor = legibleOnDark(accentSource);
  const glow = hexToRgba(accentSource, 0.3);

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

  const container: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '56px 72px',
    backgroundColor: BG,
    backgroundImage: `radial-gradient(circle at 82% 8%, ${glow} 0%, ${hexToRgba(BG, 0)} 62%)`,
    color: TEXT_PRIMARY,
    fontFamily: 'Inter, sans-serif',
  };

  const card = (
    <div style={container}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cyrillicReady && eyebrow ? (
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '0.16em',
              color: TEXT_MUTED,
              marginBottom: 10,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {cyrillicReady ? title : SITE_HOST}
        </div>
      </div>

      {aqi !== null && category ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div
            style={{
              fontSize: 224,
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
                marginTop: 26,
                padding: '12px 34px',
                borderRadius: 999,
                backgroundColor: category.color,
                color: category.textColor,
                fontSize: 36,
                fontWeight: 700,
              }}
            >
              {category.labelRu}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                marginTop: 26,
                width: 260,
                height: 18,
                borderRadius: 999,
                backgroundColor: category.color,
              }}
            />
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 400, color: TEXT_MUTED }}>
          {cyrillicReady ? NO_DATA_TEXT : '—'}
        </div>
      )}

      <div style={{ display: 'flex', fontSize: 26, fontWeight: 400, color: TEXT_MUTED }}>
        {FOOTER_TEXT}
      </div>
    </div>
  );

  return new ImageResponse(card, {
    ...OG_SIZE,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}
