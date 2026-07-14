/**
 * Загрузка шрифта с кириллицей для OG-карточек (satori).
 *
 * Дефолтный шрифт @vercel/og — Noto Sans только с латиницей: кириллица
 * без своего шрифта не отрисуется. Берём Inter из Google Fonts, субсетированный
 * под фактический текст карточки (параметр `text=` API css2 отдаёт TTF без
 * браузерного User-Agent) — приём из официальной документации Next.js.
 *
 * Ошибки сети не роняют рендер: загрузчик возвращает null, карточка
 * деградирует до латинского варианта. Успешные загрузки кэшируются
 * на время жизни инстанса, неудачные — не кэшируются (даём шанс повторить).
 */

const FONT_FETCH_TIMEOUT_MS = 10_000;

/**
 * URL TTF/OTF-файла из ответа Google Fonts CSS API.
 * null — если в CSS нет truetype/opentype-источника (например, отдан woff2).
 */
export function extractFontUrl(css: string): string | null {
  const m = css.match(/src:\s*url\((.+?)\)\s*format\('(?:opentype|truetype)'\)/);
  return m ? m[1] : null;
}

async function fetchGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
      `:wght@${weight}&text=${encodeURIComponent(text)}`;
    const cssResponse = await fetch(cssUrl, {
      signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS),
    });
    if (!cssResponse.ok) return null;
    const fontUrl = extractFontUrl(await cssResponse.text());
    if (!fontUrl) return null;
    const fontResponse = await fetch(fontUrl, {
      signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS),
    });
    if (!fontResponse.ok) return null;
    return await fontResponse.arrayBuffer();
  } catch {
    return null;
  }
}

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

/**
 * Шрифт Google Fonts, субсетированный под `text` (уникальные глифы).
 * null — при любом сбое сети/формата; сбои не кэшируются.
 */
export function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer | null> {
  const subset = Array.from(new Set(text)).sort().join('');
  const key = `${family}:${weight}:${subset}`;
  const cached = fontCache.get(key);
  if (cached) return cached;
  const pending = fetchGoogleFont(family, weight, subset).then((data) => {
    if (data === null) fontCache.delete(key);
    return data;
  });
  fontCache.set(key, pending);
  return pending;
}
