/**
 * Генерация PNG-иконок PWA из SVG-знака «Воздух Алматы».
 *
 * Знак повторяет логотип из src/components/ui/SiteHeader.tsx (LogoMark):
 * солнце и две горы Заилийского Алатау в акцентном цвете --accent светлой
 * темы (#2557C7) на поверхности --surface (#F7F7F4) из globals.css.
 *
 * Выход: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
 * Maskable-вариант держит знак в центральных 60% холста (safe zone ≥ 80%).
 *
 * Запуск: node scripts/generate-icons.mjs
 * Скрипт сам проверяет размеры результата через sharp.metadata().
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'public', 'icons');

/** --accent светлой темы из globals.css */
const ACCENT = '#2557C7';
/** --surface светлой темы из globals.css */
const BG = '#F7F7F4';

/**
 * SVG иконки: фон-квадрат + логотип (в исходном viewBox 0 0 32 32),
 * отмасштабированный с полями padRatio с каждой стороны.
 * @param {number} size — размер холста в px
 * @param {number} padRatio — доля поля с каждой стороны (0.1 = 10%)
 * @returns {string}
 */
function iconSvg(size, padRatio) {
  const scale = (size * (1 - 2 * padRatio)) / 32;
  const offset = size * padRatio;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <circle cx="8" cy="8" r="3.5" fill="${ACCENT}" fill-opacity="0.8"/>
    <path d="M2 27 L12 9 L22 27 Z" fill="${ACCENT}" fill-opacity="0.45"/>
    <path d="M12 27 L21 12 L30 27 Z" fill="${ACCENT}"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, pad: 0.1 },
  { file: 'icon-512.png', size: 512, pad: 0.1 },
  // Maskable: контент в центральных 60% — запас к минимальной safe zone 80%.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.12 },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, size, pad } of TARGETS) {
  const outPath = path.join(OUT_DIR, file);
  await sharp(Buffer.from(iconSvg(size, pad))).png().toFile(outPath);

  const meta = await sharp(outPath).metadata();
  if (meta.format !== 'png' || meta.width !== size || meta.height !== size) {
    throw new Error(
      `Некорректная иконка ${file}: ${meta.format} ${meta.width}x${meta.height}, ожидалось png ${size}x${size}`,
    );
  }
  console.log(`ok ${file} ${meta.width}x${meta.height}`);
}

console.log(`Иконки записаны в ${OUT_DIR}`);
