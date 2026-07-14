# Воздух Алматы

**https://almaty-air-two.vercel.app**

**Качество воздуха в Алматы в реальном времени.** Карта районов с текущим AQI, графики за 24 часа / 7 дней / 30 дней, понятная шкала «что это значит» и практические рекомендации.

Смог — реальная проблема Алматы, особенно в сезон зимних инверсий. Этот сервис показывает честные данные: что известно по станциям мониторинга, что — по модели, и никогда не выдаёт одно за другое.

## Данные

| Слой | Источник | Что даёт |
|---|---|---|
| Станции | [OpenAQ](https://openaq.org) (сеть сенсоров AirGradient / Almaty Air Initiative) | PM2.5 по ~124 точкам города |
| Официальные посты | [WAQI](https://aqicn.org) (Казгидромет, посольство США) | Композитный AQI станций |
| Модель | [Open-Meteo](https://open-meteo.com) (CAMS, Copernicus) | Базовый слой без ключей, история и прогноз |

Модельные данные всегда помечены как модельные (сетка CAMS ~40 км сглаживает локальные пики — об этом написано прямо в интерфейсе). AQI считается в приложении из концентраций PM2.5/PM10 по шкале US EPA (ревизия 2024 года) и покрыт юнит-тестами, включая точные границы сегментов и правила усечения.

## Стек

- **Next.js 16** (App Router, RSC, ISR), **TypeScript strict**, **Tailwind CSS v4**
- **Leaflet + OpenStreetMap** — карта районов (полигоны из OSM, ~13 КБ GeoJSON в бандле)
- **visx** — кастомные графики AQI с зонами категорий и градиентной заливкой
- **Vitest** — 107 юнит-тестов (шкала AQI, геопривязка, нормализация источников)
- Палитра категорий AQI спроектирована с монотонной прогрессией светлоты — категории различимы при дальтонизме и в градациях серого; контраст текста ≥ 4.5:1 (WCAG AA)

## Запуск

```bash
pnpm install
pnpm dev
```

Приложение работает сразу — модельный слой Open-Meteo не требует ключей. Станционные слои включаются переменными окружения (см. `.env.example`):

```
OPENAQ_API_KEY=   # бесплатно: https://explore.openaq.org/register
WAQI_TOKEN=       # бесплатно: https://aqicn.org/data-platform/token/
```

```bash
pnpm test        # юнит-тесты
pnpm typecheck   # tsc --noEmit
pnpm build       # прод-сборка
```

## Архитектура

- `src/lib/aqi.ts` — шкала US EPA (брейкпоинты PM2.5 2024 года), конвертация концентрация → AQI, категории с рекомендациями
- `src/lib/districts.ts` — 8 районов города (полигоны OSM), point-in-polygon привязка станций
- `src/lib/sources/` — независимые провайдеры (OpenAQ / WAQI / Open-Meteo) с нормализацией к общему контракту, фильтром устаревших замеров и фолбэком; агрегатор никогда не бросает — статус каждого источника показывается в UI
- Обновление данных: ISR + серверный кэш (30–60 мин), в пределах бесплатных лимитов всех источников

Решения и результаты исследования источников: [.planning/DECISIONS.md](.planning/DECISIONS.md), [.planning/RESEARCH.md](.planning/RESEARCH.md).

## Атрибуция

Данные о качестве воздуха: [Open-Meteo](https://open-meteo.com) (CC-BY 4.0), содержит модифицированные данные Copernicus Atmosphere Monitoring Service; [OpenAQ](https://openaq.org) / AirGradient; [WAQI](https://aqicn.org) / Казгидромет / U.S. Embassy Almaty. Карта: © участники [OpenStreetMap](https://www.openstreetmap.org/copyright).

---

## English

**Almaty Air** — real-time air quality dashboard for Almaty, Kazakhstan: a district map with current US EPA AQI (2024 revision), 24h/7d/30d charts, and plain-language health guidance in Russian.

Data comes from three independent layers with honest labeling: OpenAQ (AirGradient sensor network, ~124 stations), WAQI (Kazhydromet official posts + US Embassy monitor), and the Open-Meteo CAMS model as a zero-config baseline — model data is always marked as such. AQI is computed in-app from PM2.5/PM10 concentrations and covered by unit tests (exact breakpoint edges, EPA truncation rules, monotonicity).

Stack: Next.js 16 (App Router, RSC, ISR), TypeScript strict, Tailwind v4, Leaflet + OSM, visx charts, Vitest. The AQI category palette uses monotonic lightness progression (colorblind-safe, WCAG AA text contrast).

```bash
pnpm install && pnpm dev   # works out of the box — the model layer needs no API keys
```
