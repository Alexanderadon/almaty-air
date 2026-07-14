/**
 * Районы Алматы: границы (GeoJSON из OSM), центроиды и point-in-polygon.
 *
 * Данные: src/data/almaty-districts.geo.json, генерируется скриптом
 * scripts/fetch-districts.mjs (Overpass → osmtogeojson → mapshaper).
 * Атрибуция: © участники OpenStreetMap.
 *
 * Координаты в GeoJSON — [lon, lat] (стандарт GeoJSON);
 * публичный API этого модуля принимает и отдаёт (lat, lon).
 */

import { DISTRICT_SLUGS, type DistrictSlug } from './types';
import rawDistrictsGeoJson from '../data/almaty-districts.geo.json';

export interface DistrictFeatureProperties {
  slug: DistrictSlug;
  nameRu: string;
  nameEn?: string;
  osmRelationId: number;
}

/** Кольцо полигона: массив позиций [lon, lat]. */
type Ring = number[][];

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Ring[];
}

interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Ring[][];
}

export interface DistrictFeature {
  type: 'Feature';
  properties: DistrictFeatureProperties;
  geometry: PolygonGeometry | MultiPolygonGeometry;
}

export interface DistrictFeatureCollection {
  type: 'FeatureCollection';
  features: DistrictFeature[];
}

export interface District {
  slug: DistrictSlug;
  nameRu: string;
  osmRelationId: number;
  /** [lat, lon] центроида крупнейшего внешнего кольца района. */
  centroid: [number, number];
}

// resolveJsonModule выводит громоздкий литеральный тип — сужаем до контракта.
const geoJson = rawDistrictsGeoJson as unknown as DistrictFeatureCollection;

/** Полигоны геометрии единым списком: [внешнее кольцо, ...дырки][]. */
function polygonsOf(geometry: PolygonGeometry | MultiPolygonGeometry): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Удвоенная знаковая площадь кольца (формула шнурования), в град². */
function signedArea2(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum;
}

/**
 * Центроид кольца по площадной (area-weighted) формуле.
 * Для вырожденного кольца — среднее вершин.
 * Возвращает [lat, lon].
 */
function ringCentroid(ring: Ring): [number, number] {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area2 += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    let sumLon = 0;
    let sumLat = 0;
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
    }
    return [sumLat / ring.length, sumLon / ring.length];
  }
  return [cy / (3 * area2), cx / (3 * area2)];
}

/** Центроид крупнейшего (по площади внешнего кольца) полигона фичи, [lat, lon]. */
function featureCentroid(feature: DistrictFeature): [number, number] {
  let largestRing: Ring | null = null;
  let largestArea = -Infinity;
  for (const polygon of polygonsOf(feature.geometry)) {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length === 0) continue;
    const area = Math.abs(signedArea2(outerRing));
    if (area > largestArea) {
      largestArea = area;
      largestRing = outerRing;
    }
  }
  if (!largestRing) {
    throw new Error(`У района «${feature.properties.slug}» нет ни одного внешнего кольца.`);
  }
  return ringCentroid(largestRing);
}

/** Точка внутри кольца (ray casting, чётность пересечений). */
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const lonI = ring[i][0];
    const latI = ring[i][1];
    const lonJ = ring[j][0];
    const latJ = ring[j][1];
    if (
      latI > lat !== latJ > lat &&
      lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const featureBySlug = new Map<DistrictSlug, DistrictFeature>(
  geoJson.features.map((feature) => [feature.properties.slug, feature]),
);

for (const slug of DISTRICT_SLUGS) {
  if (!featureBySlug.has(slug)) {
    throw new Error(`В GeoJSON районов отсутствует «${slug}» — перегенерируйте scripts/fetch-districts.mjs.`);
  }
}

/** 8 районов Алматы в порядке DISTRICT_SLUGS; центроиды предвычислены при загрузке модуля. */
export const DISTRICTS: District[] = DISTRICT_SLUGS.map((slug) => {
  const feature = featureBySlug.get(slug) as DistrictFeature;
  return {
    slug,
    nameRu: feature.properties.nameRu,
    osmRelationId: feature.properties.osmRelationId,
    centroid: featureCentroid(feature),
  };
});

/**
 * Район, содержащий точку (lat, lon), либо null, если точка вне восьми районов.
 * Учитывает MultiPolygon и дырки: точка в дырке не принадлежит району.
 */
export function districtForPoint(lat: number, lon: number): DistrictSlug | null {
  for (const feature of geoJson.features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      const outerRing = polygon[0];
      if (!outerRing || !pointInRing(lon, lat, outerRing)) continue;
      const inHole = polygon.slice(1).some((hole) => pointInRing(lon, lat, hole));
      if (!inHole) return feature.properties.slug;
    }
  }
  return null;
}

/** Типизированная FeatureCollection границ районов (для карты Leaflet). */
export function getDistrictsGeoJSON(): DistrictFeatureCollection {
  return geoJson;
}
