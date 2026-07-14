'use client';

/**
 * Живая карта качества воздуха: границы восьми районов с заливкой цветом
 * категории AQI и круглые маркеры станций мониторинга.
 *
 * Рендерится только на клиенте — Leaflet требует window (см. MapPanel,
 * обёртку next/dynamic с ssr:false). Маркеры — CircleMarker, а не Marker:
 * дефолтные PNG-иконки Leaflet ломаются под бандлерами.
 */

import 'leaflet/dist/leaflet.css';
import {
  DomEvent,
  type CircleMarker as LeafletCircleMarker,
  type LeafletEventHandlerFnMap,
} from 'leaflet';
import { useMemo, useState } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  type GeoJSONProps,
} from 'react-leaflet';
import { pluralRu } from '@/components/home/plural';
import { aqiCategory } from '@/lib/aqi';
import { getDistrictsGeoJSON } from '@/lib/districts';
import type {
  DistrictAir,
  PollutantCode,
  SourceId,
  StationReading,
} from '@/lib/types';

export interface AirMapProps {
  districts: DistrictAir[];
  stations: StationReading[];
}

const ALMATY_CENTER: [number, number] = [43.238, 76.889];

/** Заливка при отсутствии данных — нейтральный серый, не из палитры категорий. */
const NO_DATA_FILL = '#9AA3AF';

/** Контур районов и обводка маркеров поверх светлых тайлов OSM. */
const OUTLINE_COLOR = '#3A4150';

const SOURCE_NAMES: Record<SourceId, string> = {
  openaq: 'OpenAQ',
  waqi: 'WAQI',
  openmeteo: 'Open-Meteo (модель CAMS)',
};

const POLLUTANT_NAMES: Record<PollutantCode, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
};

const CONCENTRATION_FMT = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

/** Время замера в поясе Алматы: «14 июля, 14:05». */
const OBSERVED_FMT = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/** AQI для цвета маркера: готовый stationAqi → AQI из PM2.5 → AQI из PM10. */
function stationDisplayAqi(station: StationReading): number | null {
  if (station.stationAqi !== null) return station.stationAqi;
  const pm25 = station.measurements.find((m) => m.pollutant === 'pm25');
  if (pm25?.aqi != null) return pm25.aqi;
  const pm10 = station.measurements.find((m) => m.pollutant === 'pm10');
  if (pm10?.aqi != null) return pm10.aqi;
  return null;
}

function fillColorFor(aqi: number | null): string {
  return aqi === null ? NO_DATA_FILL : aqiCategory(aqi).color;
}

/**
 * Клавиатурный доступ к маркеру станции: Leaflet делает фокусируемыми только
 * иконные Marker (keyboard: true), векторные слои (CircleMarker) — нет.
 * При добавлении слоя на карту вешаем на его SVG-путь tabindex/role/aria-label,
 * Enter и пробел открывают попап. Слушатель живёт столько же, сколько сам
 * SVG-элемент (уничтожается вместе со слоем) — отдельная отписка не нужна.
 */
function markerKeyboardHandlers(stationName: string): LeafletEventHandlerFnMap {
  return {
    add: (event) => {
      const layer = event.target as LeafletCircleMarker;
      const el = layer.getElement();
      if (!el) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Станция мониторинга ${stationName}: показать данные`);
      DomEvent.on(el as unknown as HTMLElement, 'keydown', (domEvent) => {
        const key = (domEvent as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') {
          domEvent.preventDefault();
          layer.openPopup();
        }
      });
    },
  };
}

/** Содержимое тултипа/попапа района: название, AQI, категория, происхождение данных. */
function DistrictInfo({ nameRu, air }: { nameRu: string; air: DistrictAir | null }) {
  const aqi = air?.aqi ?? null;
  return (
    <div className="text-[13px] leading-snug">
      <p className="font-semibold">{nameRu}</p>
      {air !== null && aqi !== null ? (
        <>
          <p>
            AQI {aqi} · {aqiCategory(aqi).labelRu}
          </p>
          <p>
            {air.dataOrigin === 'model'
              ? 'Модель CAMS (Copernicus)'
              : `${air.stationCount} ${pluralRu(air.stationCount, ['станция', 'станции', 'станций'])} мониторинга`}
          </p>
        </>
      ) : (
        <p>Данных пока нет</p>
      )}
    </div>
  );
}

/** Попап станции: название, значения, время замера (Asia/Almaty), источник. */
function StationInfo({ station }: { station: StationReading }) {
  const observed = new Date(station.observedAt);
  return (
    <div className="text-[13px] leading-snug">
      <p className="font-semibold">{station.name}</p>
      {station.measurements.map((m) => (
        <p key={m.pollutant}>
          {POLLUTANT_NAMES[m.pollutant]}: {CONCENTRATION_FMT.format(m.value)} мкг/м³
          {m.aqi !== null ? ` · AQI ${m.aqi}` : ''}
        </p>
      ))}
      {station.stationAqi !== null && (
        <p>AQI станции: {station.stationAqi}</p>
      )}
      {!Number.isNaN(observed.getTime()) && (
        <p>Замер: {OBSERVED_FMT.format(observed)}</p>
      )}
      <p>Источник: {SOURCE_NAMES[station.sourceId]}</p>
    </div>
  );
}

export default function AirMap({ districts, stations }: AirMapProps) {
  /*
   * Страница обязана прокручиваться поверх карты. Точная наводка (мышь,
   * тачпад): колесо зумит, перетаскивание двигает карту. Сенсорные экраны:
   * scrollWheelZoom И dragging выключены — свайп одним пальцем прокручивает
   * страницу нативно (Leaflet оставляет .leaflet-touch-zoom →
   * touch-action: pan-x pan-y), а масштаб и перемещение карты — жестом двумя
   * пальцами (touchZoom по умолчанию включён). Значение фиксируется один раз:
   * компонент монтируется только на клиенте (ssr:false в MapPanel).
   */
  const [finePointer] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );

  const airBySlug = useMemo(
    () => new Map(districts.map((d) => [d.slug, d])),
    [districts],
  );

  const features = getDistrictsGeoJSON().features;

  return (
    <MapContainer
      center={ALMATY_CENTER}
      zoom={11}
      scrollWheelZoom={finePointer}
      dragging={finePointer}
      className="h-full w-full"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">участники OpenStreetMap</a>'
      />

      {features.map((feature) => {
        const { slug, nameRu } = feature.properties;
        const air = airBySlug.get(slug) ?? null;
        return (
          <GeoJSON
            key={slug}
            /* DistrictFeature структурно совместим с GeoJSON Feature,
               но интерфейс properties не имеет index-сигнатуры — сужаем явно. */
            data={feature as unknown as GeoJSONProps['data']}
            style={{
              fillColor: fillColorFor(air?.aqi ?? null),
              fillOpacity: 0.35,
              color: OUTLINE_COLOR,
              opacity: 0.7,
              weight: 1,
            }}
          >
            <Tooltip sticky>
              <DistrictInfo nameRu={nameRu} air={air} />
            </Tooltip>
            <Popup>
              <DistrictInfo nameRu={nameRu} air={air} />
            </Popup>
          </GeoJSON>
        );
      })}

      {stations.map((station) => {
        const position: [number, number] = [station.lat, station.lon];
        return (
          <CircleMarker
            key={`${station.sourceId}-${station.stationId}`}
            center={position}
            /* radius 9 → ~21px цель касания: попап станции реально открыть пальцем. */
            radius={9}
            eventHandlers={markerKeyboardHandlers(station.name)}
            pathOptions={{
              fillColor: fillColorFor(stationDisplayAqi(station)),
              fillOpacity: 0.95,
              color: OUTLINE_COLOR,
              weight: 1.5,
            }}
          >
            <Popup>
              <StationInfo station={station} />
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
