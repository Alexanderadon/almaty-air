#!/usr/bin/env node
/**
 * Генерация src/data/almaty-districts.geo.json — границы 8 районов Алматы.
 *
 * Пайплайн (проверен end-to-end 2026-07-14):
 *   1. Overpass API: relations admin_level=6 по фиксированным id (только id,
 *      без кириллицы в запросе). overpass-api.de даёт 2 слота на IP —
 *      никаких параллельных запросов, на 429 ретрай с бэкоффом.
 *   2. npx osmtogeojson — OSM JSON -> GeoJSON.
 *   3. npx mapshaper — фильтрация полей + упрощение visvalingam 8%
 *      keep-shapes, точность координат 0.00001 (~1 м).
 *   4. Пост-обработка в node: слаг района по русскому названию,
 *      osmRelationId, валидация (8 фич, bbox, размер файла).
 *
 * Фолбэк при недоступности Overpass (3 неудачных попытки):
 *   https://raw.githubusercontent.com/akilbekov/almaty.geo.json/master/almaty-districts.geo.json
 *   (Unlicense, те же relation id) — затем то же упрощение mapshaper.
 *
 * Запуск:  node scripts/fetch-districts.mjs
 * Атрибуция данных: © участники OpenStreetMap.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, '.districts-tmp');
const OUT = path.join(ROOT, 'src', 'data', 'almaty-districts.geo.json');

// OSM relations admin_level=6 (проверено 2026-07-14).
const DISTRICT_INDEX = [
  { slug: 'alatau', adjective: 'Алатауский', osmRelationId: 3072216 },
  { slug: 'almaly', adjective: 'Алмалинский', osmRelationId: 3072807 },
  { slug: 'auezov', adjective: 'Ауэзовский', osmRelationId: 3072808 },
  { slug: 'bostandyk', adjective: 'Бостандыкский', osmRelationId: 3390291 },
  { slug: 'zhetysu', adjective: 'Жетысуский', osmRelationId: 3072130 },
  { slug: 'medeu', adjective: 'Медеуский', osmRelationId: 3072217 },
  { slug: 'nauryzbay', adjective: 'Наурызбайский', osmRelationId: 5460063 },
  { slug: 'turksib', adjective: 'Турксибский', osmRelationId: 3072001 },
];

const RELATION_IDS = DISTRICT_INDEX.map((d) => d.osmRelationId).sort((a, b) => a - b);

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_QUERY = `[out:json][timeout:90];rel(id:${RELATION_IDS.join(',')});out geom;`;
const FALLBACK_URL =
  'https://raw.githubusercontent.com/akilbekov/almaty.geo.json/master/almaty-districts.geo.json';

// Ожидаемый bbox Алматы (границы районов), допуск ±0.05°.
const EXPECTED_BBOX = { minLon: 76.742, maxLon: 77.167, minLat: 43.033, maxLat: 43.404 };
const BBOX_TOLERANCE = 0.05;
const MAX_FILE_BYTES = 100 * 1024;

const MAX_BUFFER = 512 * 1024 * 1024;

function fail(message) {
  console.error(`ОШИБКА: ${message}`);
  rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** curl -> файл; возвращает HTTP-код строкой либо null при сетевой ошибке. */
function curlToFile(url, extraArgs, outFile) {
  const res = spawnSync(
    'curl',
    ['-sS', '--max-time', '120', ...extraArgs, url, '-o', outFile, '-w', '%{http_code}'],
    { encoding: 'utf8', maxBuffer: MAX_BUFFER },
  );
  if (res.error) {
    console.error(`curl не запустился: ${res.error.message}`);
    return null;
  }
  if (res.status !== 0) {
    console.error(`curl завершился с кодом ${res.status}: ${(res.stderr || '').trim()}`);
    return null;
  }
  return (res.stdout || '').trim();
}

/** npx --yes <командная строка>; stdout возвращается строкой. */
function runNpx(commandLine) {
  const res = spawnSync(`npx --yes ${commandLine}`, {
    shell: true,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    cwd: ROOT,
  });
  if (res.error) fail(`npx не запустился: ${res.error.message}`);
  if (res.status !== 0) {
    fail(`«npx --yes ${commandLine}» завершилась с кодом ${res.status}:\n${res.stderr}`);
  }
  return res.stdout;
}

/** Overpass с ретраями (2 слота на IP; на 429/5xx — бэкофф). */
async function fetchFromOverpass() {
  const osmPath = path.join(TMP, 'overpass.json');
  const delaysMs = [0, 10_000, 30_000];
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (delaysMs[attempt] > 0) {
      console.log(`Ожидание ${delaysMs[attempt] / 1000} с перед повтором...`);
      await sleep(delaysMs[attempt]);
    }
    console.log(`Overpass: попытка ${attempt + 1}/${delaysMs.length}...`);
    const code = curlToFile(OVERPASS_URL, ['-G', '--data-urlencode', `data=${OVERPASS_QUERY}`], osmPath);
    if (code === '200') {
      try {
        const parsed = JSON.parse(readFileSync(osmPath, 'utf8'));
        const relations = (parsed.elements ?? []).filter((e) => e.type === 'relation');
        if (relations.length !== RELATION_IDS.length) {
          console.error(`Overpass вернул ${relations.length} relations вместо ${RELATION_IDS.length}.`);
          continue;
        }
        return osmPath;
      } catch (e) {
        console.error(`Ответ Overpass не парсится как JSON: ${e instanceof Error ? e.message : e}`);
        continue;
      }
    }
    console.error(`Overpass: HTTP ${code ?? 'сетевая ошибка'}.`);
  }
  return null;
}

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  fail(`Неожиданный тип геометрии: ${geometry.type}`);
  return [];
}

function computeBbox(features) {
  const bbox = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const feature of features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          bbox.minLon = Math.min(bbox.minLon, lon);
          bbox.maxLon = Math.max(bbox.maxLon, lon);
          bbox.minLat = Math.min(bbox.minLat, lat);
          bbox.maxLat = Math.max(bbox.maxLat, lat);
        }
      }
    }
  }
  return bbox;
}

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(path.dirname(OUT), { recursive: true });

  const rawGeoJsonPath = path.join(TMP, 'raw.geojson');
  let usedFallback = false;

  const osmPath = await fetchFromOverpass();
  if (osmPath) {
    console.log('osmtogeojson: OSM JSON -> GeoJSON...');
    const geojsonText = runNpx(`osmtogeojson "${osmPath}"`);
    writeFileSync(rawGeoJsonPath, geojsonText, 'utf8');
  } else {
    console.warn('Overpass недоступен после 3 попыток — фолбэк на akilbekov/almaty.geo.json (Unlicense).');
    usedFallback = true;
    const code = curlToFile(FALLBACK_URL, ['-L'], rawGeoJsonPath);
    if (code !== '200') fail(`Фолбэк-источник тоже недоступен (HTTP ${code ?? 'сетевая ошибка'}).`);
  }

  const simplifiedPath = path.join(TMP, 'simplified.geojson');
  console.log('mapshaper: упрощение visvalingam 8% keep-shapes...');
  // В фолбэк-файле другой набор полей, поэтому -filter-fields только для Overpass-ветки;
  // пост-обработка ниже в любом случае переписывает properties начисто.
  const filterFields = usedFallback ? '' : '-filter-fields name,name:ru,name:en ';
  runNpx(
    `mapshaper "${rawGeoJsonPath}" ${filterFields}-simplify visvalingam 8% keep-shapes -o precision=0.00001 format=geojson "${simplifiedPath}"`,
  );

  const collection = JSON.parse(readFileSync(simplifiedPath, 'utf8'));
  const features = collection.features ?? [];
  if (features.length !== 8) fail(`Ожидалось ровно 8 фич, получено ${features.length}.`);

  // Пост-обработка: слаг по русскому названию, минимальный набор properties.
  const seenSlugs = new Set();
  const outFeatures = features.map((feature) => {
    const props = feature.properties ?? {};
    const nameRu = props['name:ru'] ?? props.nameRu ?? props.name;
    if (typeof nameRu !== 'string' || nameRu.length === 0) {
      fail(`У фичи нет русского названия: ${JSON.stringify(props)}`);
    }
    const entry = DISTRICT_INDEX.find((d) => nameRu.includes(d.adjective));
    if (!entry) fail(`Название «${nameRu}» не соответствует ни одному из 8 районов.`);
    if (seenSlugs.has(entry.slug)) fail(`Дубликат района: ${entry.slug}.`);
    seenSlugs.add(entry.slug);
    const properties = {
      slug: entry.slug,
      nameRu,
      osmRelationId: entry.osmRelationId,
    };
    const nameEn = props['name:en'] ?? props.nameEn;
    if (typeof nameEn === 'string' && nameEn.length > 0) properties.nameEn = nameEn;
    return { type: 'Feature', properties, geometry: feature.geometry };
  });
  if (seenSlugs.size !== 8) fail(`Найдено ${seenSlugs.size} районов из 8.`);

  const bbox = computeBbox(outFeatures);
  for (const [key, expected] of Object.entries(EXPECTED_BBOX)) {
    if (Math.abs(bbox[key] - expected) > BBOX_TOLERANCE) {
      fail(
        `bbox.${key} = ${bbox[key].toFixed(5)} вне допуска ±${BBOX_TOLERANCE} от ожидаемого ${expected}.`,
      );
    }
  }

  const outCollection = { type: 'FeatureCollection', features: outFeatures };
  writeFileSync(OUT, JSON.stringify(outCollection), 'utf8');

  const sizeBytes = statSync(OUT).size;
  if (sizeBytes > MAX_FILE_BYTES) {
    fail(`Файл ${(sizeBytes / 1024).toFixed(1)} КБ превышает лимит ${MAX_FILE_BYTES / 1024} КБ.`);
  }

  rmSync(TMP, { recursive: true, force: true });
  console.log(
    `Готово: ${OUT}\n` +
      `  Источник: ${usedFallback ? 'фолбэк akilbekov/almaty.geo.json' : 'Overpass API'}\n` +
      `  Фич: ${outFeatures.length}, размер: ${(sizeBytes / 1024).toFixed(1)} КБ\n` +
      `  bbox: ${bbox.minLon.toFixed(3)}–${bbox.maxLon.toFixed(3)} E / ${bbox.minLat.toFixed(3)}–${bbox.maxLat.toFixed(3)} N`,
  );
}

main().catch((e) => fail(e instanceof Error ? (e.stack ?? e.message) : String(e)));
