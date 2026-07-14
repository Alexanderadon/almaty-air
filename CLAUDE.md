# Воздух Алматы — контекст для Claude Code

## Что это

Публичный продукт (НЕ пет-проект, слов «демо/учебный» нигде не писать): дашборд качества воздуха Алматы. Владелец: Alexander Kurchakov (Frontend + UI/UX, Almaty; GitHub Alexanderadon). Бриф: `.planning/BRIEF.md`. Решения: `.planning/DECISIONS.md`. Исследование источников: `.planning/RESEARCH.md` — читать перед изменением data-слоя.

## Жёсткие правила

- **Только реальные данные.** Никаких выдуманных значений AQI, модельные данные всегда помечены как модельные (D9 в DECISIONS.md).
- UI на русском. TypeScript strict. Приложение бесплатное и без рекламы (условие free-tier Open-Meteo и WAQI).
- AQI считаем сами из концентраций (US EPA, ревизия PM2.5 2024) — `src/lib/aqi.ts`, не доверять чужим композитным AQI.
- Контракт данных: `src/lib/types.ts` — менять только осознанно, от него зависят все слои.

## Архитектура

- `src/lib/sources/` — провайдеры OpenAQ (ключ `OPENAQ_API_KEY`) / WAQI (`WAQI_TOKEN`) / Open-Meteo (без ключа). Никогда не бросают; агрегатор `getCityAir()` собирает что есть.
- `src/lib/districts.ts` + `src/data/almaty-districts.geo.json` — 8 районов OSM (перегенерация: `node scripts/fetch-districts.mjs`).
- Карта: Leaflet (только CircleMarker, дефолтные Marker-иконки сломаны под бандлером). Графики: visx (НЕ recharts — решение D3).
- ISR: revalidate 3600 на страницах, fetch-кэш 1800/3600 в источниках.

## Команды

`pnpm dev` / `pnpm build` / `pnpm test` (Vitest, 107+) / `pnpm typecheck` / `pnpm lint`

## Статус фаз (бриф §Процесс)

1. ✅ Data-слой + скелет + деплой (2026-07-14)
2. ✅ Карта + текущий AQI (2026-07-14)
3. ⬜ История в своей БД (решение D6: Supabase Postgres + Prisma, НЕ Neon) + `/api/collect` с секретом + cron-job.org
4. ⬜ PWA (Serwist — НЕ next-pwa, он мёртв) + web-push (VAPID, iOS 16.4+: standalone + юзер-жест)
5. ⬜ QA (Playwright smoke, Lighthouse ≥90/95), динамические OG-карточки, README-скриншоты, Vercel Analytics

## Шаги только для владельца (D8)

OpenAQ-ключ, WAQI-токен (+письмо их команде до публичного анонса), финальная проверка PWA на телефоне.

@AGENTS.md
