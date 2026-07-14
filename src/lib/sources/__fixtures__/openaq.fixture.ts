/**
 * Фикстуры OpenAQ v3: структура по docs (схемы LocationsResponse/LatestResponse
 * из живого openapi.json api.openaq.org, сверено 2026-07-14), значения
 * синтетические — только для тестов.
 *
 * Опорное «сейчас» в тестах: 2026-07-14T09:00:00Z (порог свежести — 3 часа).
 * Состав:
 * - 2001 — Алмалинский район, свежая, PM2.5 18.4 → станция попадает в выдачу;
 * - 2002 — Бостандыкский район, свежая, PM2.5 12.1 → попадает в выдачу;
 * - 2003 — Ауэзовский район, datetimeLast устарел (>3 ч) → latest не запрашивается;
 * - 2004 — вне восьми районов, локация свежая, но само значение старше 3 ч → отбрасывается;
 * - 2005 — без координат → отбрасывается до запроса latest.
 */

export const openAqLocationsResponse = {
  meta: { name: 'openaq-api', website: '/', page: 1, limit: 1000, found: 5 },
  results: [
    {
      id: 2001,
      name: 'AirGradient Almaty Center',
      locality: 'Almaty',
      timezone: 'Asia/Almaty',
      isMobile: false,
      isMonitor: false,
      coordinates: { latitude: 43.2523, longitude: 76.9089 },
      sensors: [
        { id: 9001, name: 'pm25 µg/m³', parameter: { id: 2, name: 'pm25', units: 'µg/m³', displayName: 'PM2.5' } },
      ],
      datetimeFirst: { utc: '2025-11-01T00:00:00Z', local: '2025-11-01T05:00:00+05:00' },
      datetimeLast: { utc: '2026-07-14T08:15:00Z', local: '2026-07-14T13:15:00+05:00' },
    },
    {
      id: 2002,
      name: 'AirGradient Bostandyk',
      locality: 'Almaty',
      timezone: 'Asia/Almaty',
      isMobile: false,
      isMonitor: false,
      coordinates: { latitude: 43.1557, longitude: 76.9234 },
      sensors: [
        { id: 9002, name: 'pm25 µg/m³', parameter: { id: 2, name: 'pm25', units: 'µg/m³', displayName: 'PM2.5' } },
      ],
      datetimeFirst: { utc: '2025-11-01T00:00:00Z', local: '2025-11-01T05:00:00+05:00' },
      datetimeLast: { utc: '2026-07-14T08:40:00Z', local: '2026-07-14T13:40:00+05:00' },
    },
    {
      id: 2003,
      name: 'AirGradient Auezov (silent)',
      locality: 'Almaty',
      timezone: 'Asia/Almaty',
      isMobile: false,
      isMonitor: false,
      coordinates: { latitude: 43.2238, longitude: 76.8505 },
      sensors: [
        { id: 9003, name: 'pm25 µg/m³', parameter: { id: 2, name: 'pm25', units: 'µg/m³', displayName: 'PM2.5' } },
      ],
      datetimeFirst: { utc: '2025-11-01T00:00:00Z', local: '2025-11-01T05:00:00+05:00' },
      datetimeLast: { utc: '2026-07-13T22:00:00Z', local: '2026-07-14T03:00:00+05:00' },
    },
    {
      id: 2004,
      name: 'AirGradient Talgar (outside city)',
      locality: 'Talgar',
      timezone: 'Asia/Almaty',
      isMobile: false,
      isMonitor: false,
      coordinates: { latitude: 44.0, longitude: 77.5 },
      sensors: [
        { id: 9004, name: 'pm25 µg/m³', parameter: { id: 2, name: 'pm25', units: 'µg/m³', displayName: 'PM2.5' } },
      ],
      datetimeFirst: { utc: '2025-11-01T00:00:00Z', local: '2025-11-01T05:00:00+05:00' },
      datetimeLast: { utc: '2026-07-14T08:10:00Z', local: '2026-07-14T13:10:00+05:00' },
    },
    {
      id: 2005,
      name: 'AirGradient no-coords',
      locality: 'Almaty',
      timezone: 'Asia/Almaty',
      isMobile: false,
      isMonitor: false,
      coordinates: null,
      sensors: [
        { id: 9005, name: 'pm25 µg/m³', parameter: { id: 2, name: 'pm25', units: 'µg/m³', displayName: 'PM2.5' } },
      ],
      datetimeFirst: { utc: '2025-11-01T00:00:00Z', local: '2025-11-01T05:00:00+05:00' },
      datetimeLast: { utc: '2026-07-14T08:20:00Z', local: '2026-07-14T13:20:00+05:00' },
    },
  ],
};

/** Ответы /v3/locations/{id}/latest, ключ — id локации. */
export const openAqLatestByLocation: Record<
  number,
  { meta: object; results: object[] }
> = {
  2001: {
    meta: { name: 'openaq-api', website: '/', page: 1, limit: 100, found: 1 },
    results: [
      {
        datetime: { utc: '2026-07-14T08:15:00Z', local: '2026-07-14T13:15:00+05:00' },
        value: 18.4,
        coordinates: { latitude: 43.2523, longitude: 76.9089 },
        sensorsId: 9001,
        locationsId: 2001,
      },
    ],
  },
  2002: {
    meta: { name: 'openaq-api', website: '/', page: 1, limit: 100, found: 1 },
    results: [
      {
        datetime: { utc: '2026-07-14T08:40:00Z', local: '2026-07-14T13:40:00+05:00' },
        value: 12.1,
        coordinates: { latitude: 43.1557, longitude: 76.9234 },
        sensorsId: 9002,
        locationsId: 2002,
      },
    ],
  },
  // Локация свежа по datetimeLast, но само PM2.5-значение старше трёх часов.
  2004: {
    meta: { name: 'openaq-api', website: '/', page: 1, limit: 100, found: 1 },
    results: [
      {
        datetime: { utc: '2026-07-14T05:00:00Z', local: '2026-07-14T10:00:00+05:00' },
        value: 33.0,
        coordinates: { latitude: 44.0, longitude: 77.5 },
        sensorsId: 9004,
        locationsId: 2004,
      },
    ],
  },
};
