# Исследование источников данных — 2026-07-14

Все факты проверены живыми запросами (curl) 2026-07-14, не по памяти. 6 параллельных исследователей.

## Вердикт по источникам

| Источник | Статус | Роль в проекте |
|---|---|---|
| **OpenAQ v3** | 124 активных сенсора AirGradient в Алматы, свежесть 41 мин–2 ч | **Primary** (станции), нужен бесплатный ключ |
| **WAQI (aqicn.org)** | Станции: US Embassy, Казгидромет (сеть kz-hydromet, 193 станции), Alma Garden и др. | **Secondary** (официальные данные), нужен бесплатный токен |
| **Open-Meteo AQ** | Работает без ключа, проверено: PM2.5=18.9, PM10=26.7, US AQI=63 (14.07 12:00) | **Baseline/fallback + история + прогноз** (модель!) |
| AirKaz.org | МЁРТВ: 3 живых сенсора из 84, сеть умерла ~фев 2026 | НЕ использовать |
| IQAir free | Только city-level AQI, без концентраций; 5/мин; ключ истекает через 12 мес | НЕ использовать |
| Казгидромет напрямую | Публичного API нет (Shiny-app + мобильное приложение) | Через WAQI (kz-hydromet) |

## OpenAQ v3 (primary)

- **Ключ обязателен**: 401 без ключа (проверено). Бесплатная регистрация: https://explore.openaq.org/register → ключ в X-API-Key. Лимиты: 60 req/min, 2000 req/hr.
- v2 мёртв (HTTP 410). Гео-параметры: `coordinates=43.238,76.889` (lat,lon), `radius` в метрах, **максимум 25000**.
- Алматы: 165 локаций, **124 активных — все AirGradient** (провайдер #66), школьная сеть Almaty Air Initiative, репортят с дек 2025. **Только PM2.5** (плюс PM1/RH/temp на устройствах). PM10/NO2/SO2/CO/O3 — нет.
- Мертвецы, отфильтровываются `active`: 33 сенсора Clarity (умерли ~сер. 2025), монитор Консульства США #8876 (умер ~ноя 2025 — Госдеп отключил AirNow-фиды в марте 2025).
- Риск: вся живая сеть — один провайдер (AirGradient), ей ~7 месяцев. Нужен баннер устаревания данных + фолбэк.
- S3-архив `openaq-data-archive` публичный без ключа, но лаг ~3 дня — только для истории.

## WAQI (secondary)

- Токен: мгновенно через форму https://aqicn.org/data-platform/token/ (email+имя).
- Покрытие Алматы: станции Almaty, Almaty US Embassy, Alma Garden, Алматы санаторий, Сайран (A162781); **вся сеть Казгидромета доступна как kz-hydromet**.
- Эндпоинты: `api.waqi.info/feed/geo:43.238;76.889/`, `/feed/A162781/`, `/map/bounds?latlng=...`. Городской алиас `feed/almaty` показывал PM2.5=n/a — использовать станционные фиды, не алиас.
- `token=demo` бесполезен — возвращает Шанхай на любой запрос.
- ToS: бесплатно, **нельзя в платных приложениях**, обязательная атрибуция WAQI + первоисточник (Kazhydromet, US Embassy), некоммерческое публичное использование — уведомить команду по email до запуска.

## Open-Meteo Air Quality (baseline, без ключа)

- `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=43.238&longitude=76.889&...` — работает без ключа, проверено.
- **Модель CAMS Global (~40 км сетка)**, НЕ станции. cams_europe (11 км) Алматы не покрывает (проверено — "No data"). Обновление каждые 12 ч, 3-часовой шаг интерполирован в часовой. Обязательно честно маркировать в UI: «модель CAMS (Copernicus)».
- Сетка снапится: 43.238/76.889 → 43.20/76.90, elev 815 м.
- `past_days` до 92 (хватает на 24ч/7д/30д), история через start/end_date до ~авг 2022. Прогноз 5 дней. Хвост серии — null (обрабатывать).
- `us_aqi` — композитный по всем загрязнителям (может быть озоновым) — НЕ выдавать за PM2.5 AQI; считать AQI из PM самим.
- Лимиты free non-commercial: 600/мин, 5000/час, 10000/день. **Без рекламы и подписок**, иначе платный план. Лицензия CC-BY 4.0, атрибуция Open-Meteo + Copernicus CAMS.

## GeoJSON районов (проверенный пайплайн)

- 8 районов = OSM relations admin_level=6: Турксибский 3072001, Жетысуский 3072130, Алатауский 3072216, Медеуский 3072217, Алмалинский 3072807, Ауэзовский 3072808, Бостандыкский 3390291, Наурызбайский 5460063.
- Пайплайн (выполнен end-to-end, работает): Overpass `rel(id:...);out geom;` (528 КБ) → `npx osmtogeojson` (466 КБ) → `npx mapshaper -filter-fields name,name:ru,name:en -simplify visvalingam 8% keep-shapes -o precision=0.00001` → **13.4 КБ**, все name:ru на месте.
- Генерировать ОДИН раз, класть статикой. Runtime-Overpass запрещён (лимит 2 слота/IP, зеркала падают).
- Фолбэк: akilbekov/almaty.geo.json (Unlicense, 98 КБ, те же relation IDs, снапшот 2017).
- Гочи Windows: кириллица в Overpass-запросах через curl.exe ломается — запрашивать по ID; атрибуция «© участники OpenStreetMap» (ODbL).
- geoBoundaries/GADM городских районов НЕ содержат (проверено). HDX COD-AB содержит (KAZ004001-008), но 5.2 МБ shp, имена только англ.

## Стек-решения (проверено по npm registry / bundlephobia / webkit.org)

- **Графики: visx 4.0.0** (июнь 2026, Airbnb). Хирургические пакеты @visx/shape+scale+axis+gradient+group+tooltip ≈ 30–40 КБ gzip, unstyled — потолок кастомизации не ограничен, статика рендерится в RSC. Recharts 3.9.2 отвергнут: 145 КБ gzip, внутри Redux-стор, жёстко client-bound.
- **PWA: Serwist 9.5.11** (май 2026, назван в официальном Next.js PWA-гайде). next-pwa мёртв (2022), @ducanh2912/next-pwa заброшен (2024, автор ушёл делать Serwist). Прод-сборка: `next build --webpack` (или проверить @serwist/turbopack).
- **Web Push iOS** (webkit.org): iOS 16.4+, только установленная PWA (display: standalone), запрос разрешения ТОЛЬКО из юзер-жеста. Сервер: npm `web-push` 3.6.7 + VAPID (официальный гайд Next.js).

## Ссылки-первоисточники

- https://docs.openaq.org/using-the-api/api-key · https://explore.openaq.org/register
- https://aqicn.org/data-platform/token/ · https://aqicn.org/network/kz-hydromet/
- https://open-meteo.com/en/docs/air-quality-api · https://open-meteo.com/en/terms
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://nextjs.org/docs/app/guides/progressive-web-apps
- https://air.org.kz (Almaty Air Initiative — сеть-преемник AirKaz)
