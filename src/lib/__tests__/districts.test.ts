import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DISTRICT_SLUGS, type DistrictSlug } from '../types';
import { DISTRICTS, districtForPoint, getDistrictsGeoJSON } from '../districts';

const GEOJSON_PATH = fileURLToPath(
  new URL('../../data/almaty-districts.geo.json', import.meta.url),
);

const EXPECTED_NAME_RU: Record<DistrictSlug, string> = {
  alatau: 'Алатауский район',
  almaly: 'Алмалинский район',
  auezov: 'Ауэзовский район',
  bostandyk: 'Бостандыкский район',
  zhetysu: 'Жетысуский район',
  medeu: 'Медеуский район',
  nauryzbay: 'Наурызбайский район',
  turksib: 'Турксибский район',
};

const EXPECTED_OSM_RELATION_ID: Record<DistrictSlug, number> = {
  alatau: 3072216,
  almaly: 3072807,
  auezov: 3072808,
  bostandyk: 3390291,
  zhetysu: 3072130,
  medeu: 3072217,
  nauryzbay: 5460063,
  turksib: 3072001,
};

describe('almaty-districts.geo.json', () => {
  it('содержит ровно 8 фич с корректными слагами', () => {
    const collection = getDistrictsGeoJSON();
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(8);
    const slugs = collection.features.map((f) => f.properties.slug).sort();
    expect(slugs).toEqual([...DISTRICT_SLUGS].sort());
  });

  it('каждая фича несёт русское название и id OSM-relation', () => {
    for (const feature of getDistrictsGeoJSON().features) {
      const { slug, nameRu, osmRelationId } = feature.properties;
      expect(nameRu).toBe(EXPECTED_NAME_RU[slug]);
      expect(osmRelationId).toBe(EXPECTED_OSM_RELATION_ID[slug]);
    }
  });

  it('весит меньше 100 КБ', () => {
    expect(statSync(GEOJSON_PATH).size).toBeLessThan(100 * 1024);
  });
});

describe('DISTRICTS', () => {
  it('содержит все 8 районов в порядке DISTRICT_SLUGS', () => {
    expect(DISTRICTS.map((d) => d.slug)).toEqual([...DISTRICT_SLUGS]);
  });

  it('центроиды лежат в границах Алматы', () => {
    for (const district of DISTRICTS) {
      const [lat, lon] = district.centroid;
      expect(lat).toBeGreaterThan(43.0);
      expect(lat).toBeLessThan(43.45);
      expect(lon).toBeGreaterThan(76.7);
      expect(lon).toBeLessThan(77.2);
    }
  });
});

describe('districtForPoint', () => {
  it('центроид каждого района попадает в свой же район', () => {
    for (const district of DISTRICTS) {
      const [lat, lon] = district.centroid;
      expect(districtForPoint(lat, lon), district.slug).toBe(district.slug);
    }
  });

  it('точка вне города (Астана) — null', () => {
    expect(districtForPoint(51.16, 71.47)).toBeNull();
  });
});
