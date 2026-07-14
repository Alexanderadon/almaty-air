'use client';

/**
 * Кнопка «Где я?» — кастомный контрол Leaflet (верхний правый угол карты).
 *
 * По клику (жест пользователя) запрашивает геолокацию браузера; координаты
 * никуда не отправляются и живут только в состоянии компонента.
 * Точка попадает в один из восьми районов → карта приближается к ней,
 * синяя точка «Вы здесь» и попап с AQI района и ссылкой на его страницу.
 * Точка вне районов → попап с ближайшим районом (по центроиду).
 * Отказ/ошибка → ненавязчивая плашка на карте, исчезает через 5 секунд.
 *
 * Контрол создаётся императивно (L.Control), кнопка — настоящий <button>
 * с русским aria-label; если navigator.geolocation недоступен,
 * контрол не показывается вовсе.
 */

import {
  Control,
  DomEvent,
  DomUtil,
  type CircleMarker as LeafletCircleMarker,
} from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import { aqiCategory } from '@/lib/aqi';
import { DISTRICTS, districtForPoint } from '@/lib/districts';
import type { DistrictAir, DistrictSlug } from '@/lib/types';
import { nearestDistrict } from './helpers';

/** Синяя точка «Вы здесь»: hex, а не var(--accent) — SVG-атрибуты Leaflet не понимают var(). */
const YOU_ARE_HERE_FILL = '#1D6FE8';

/** Статичная иконка-прицел; никаких внешних данных внутри. */
const CROSSHAIR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="7"/>' +
  '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>' +
  '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' +
  '</svg>';

interface LocationFix {
  lat: number;
  lon: number;
  slug: DistrictSlug | null;
  /** Метка времени — чтобы повторный клик заново открывал попап. */
  at: number;
}

interface Notice {
  text: string;
  at: number;
}

const NAME_BY_SLUG = new Map(DISTRICTS.map((d) => [d.slug, d.nameRu] as const));

function aqiLine(nameRu: string, air: DistrictAir | undefined): string {
  const aqi = air?.aqi ?? null;
  return aqi !== null
    ? `${nameRu}: AQI ${aqi} — ${aqiCategory(aqi).labelRu}`
    : `${nameRu}: данных по воздуху пока нет`;
}

export interface LocateControlProps {
  districts: DistrictAir[];
}

export default function LocateControl({ districts }: LocateControlProps) {
  const map = useMap();
  // Компонент монтируется только на клиенте (ssr:false в MapPanel),
  // но navigator проверяем защитно — как finePointer в AirMap.
  const [hasGeolocation] = useState(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const markerRef = useRef<LeafletCircleMarker | null>(null);

  const airBySlug = useMemo(
    () => new Map(districts.map((d) => [d.slug, d])),
    [districts],
  );

  const locate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        const slug = districtForPoint(lat, lon);
        setFix({ lat, lon, slug, at: Date.now() });
        map.setView([lat, lon], slug !== null ? 13 : 12);
      },
      () => {
        setNotice({
          text: 'Геолокация недоступна или запрещена в браузере',
          at: Date.now(),
        });
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, [map]);

  // Контрол в стиле Leaflet: контейнер leaflet-bar, внутри — доступная кнопка.
  useEffect(() => {
    if (!hasGeolocation) return;
    const control = new Control({ position: 'topright' });
    control.onAdd = () => {
      const container = DomUtil.create('div', 'leaflet-bar leaflet-control');
      const button = DomUtil.create('button', '', container) as HTMLButtonElement;
      button.type = 'button';
      button.title = 'Где я?';
      button.setAttribute('aria-label', 'Показать моё местоположение на карте');
      button.innerHTML = CROSSHAIR_SVG;
      button.style.cssText =
        'display:flex;align-items:center;justify-content:center;' +
        'width:34px;height:34px;padding:0;border:none;cursor:pointer;' +
        'background:var(--card);color:var(--foreground);';
      DomEvent.disableClickPropagation(container);
      DomEvent.disableScrollPropagation(container);
      DomEvent.on(button, 'click', locate);
      return container;
    };
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, hasGeolocation, locate]);

  // Попап открывается сам при каждом новом определении позиции.
  useEffect(() => {
    if (fix !== null) markerRef.current?.openPopup();
  }, [fix]);

  // Плашка об ошибке исчезает через 5 секунд.
  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!hasGeolocation) return null;

  const nearest = fix !== null && fix.slug === null
    ? nearestDistrict(fix.lat, fix.lon)
    : null;

  return (
    <>
      {fix !== null && (
        <CircleMarker
          ref={markerRef}
          center={[fix.lat, fix.lon]}
          radius={8}
          pathOptions={{
            color: '#FFFFFF',
            weight: 2,
            fillColor: YOU_ARE_HERE_FILL,
            fillOpacity: 1,
          }}
        >
          <Popup>
            <div className="text-[13px] leading-snug">
              {fix.slug !== null ? (
                <>
                  <p className="font-semibold">Вы здесь</p>
                  <p>
                    {aqiLine(
                      NAME_BY_SLUG.get(fix.slug) ?? fix.slug,
                      airBySlug.get(fix.slug),
                    )}
                  </p>
                  <p className="mt-1">
                    <a className="underline" href={`/district/${fix.slug}`}>
                      Воздух в вашем районе →
                    </a>
                  </p>
                </>
              ) : (
                nearest !== null && (
                  <>
                    <p className="font-semibold">
                      Вы за пределами восьми районов Алматы
                    </p>
                    <p>
                      Ближайший район —{' '}
                      {aqiLine(nearest.nameRu, airBySlug.get(nearest.slug))}
                    </p>
                    <p className="mt-1">
                      <a
                        className="underline"
                        href={`/district/${nearest.slug}`}
                      >
                        Воздух в ближайшем районе →
                      </a>
                    </p>
                  </>
                )
              )}
            </div>
          </Popup>
        </CircleMarker>
      )}

      {notice !== null && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] flex justify-center px-3"
        >
          <span className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground shadow-md">
            {notice.text}
          </span>
        </div>
      )}
    </>
  );
}
