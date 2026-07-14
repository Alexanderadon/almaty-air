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

## Деплой

Прод: https://almaty-air-two.vercel.app (Vercel, scope fistin103-3986s-projects, проект almaty-air). Деплой: `npx vercel@latest --prod --yes` (CLI залогинен на машине; Vercel MCP-коннектор НЕ имеет прав создавать проекты — деплоить через CLI). Git-интеграция Vercel↔GitHub не подключена (опционально, через дашборд).

## Статус фаз (бриф §Процесс)

1. ✅ Data-слой + скелет + деплой (2026-07-14)
2. ✅ Карта + текущий AQI (2026-07-14)
3. ✅ История в БД (2026-07-14): Supabase схема `almaty_air` ВНУТРИ проекта resto-miniapp (лимит 2 free-проектов; роль `almaty_air_app`, доступ только к схеме) + Prisma 7 (`postinstall: prisma generate`, клиент в `src/generated/`, gitignored) + `/api/collect` (timing-safe секрет) + **cron: GitHub Actions hourly** (`collect.yml`, секрет `COLLECT_SECRET` в repo secrets — НЕ cron-job.org, отдельная регистрация не нужна). График берёт БД при покрытии ≥80% окна, иначе модель.
4. ✅ PWA + push (2026-07-14): Serwist (`next build --webpack` — прод-сборка НЕ turbopack), manifest + иконки (`scripts/generate-icons.mjs`), web-push VAPID (env в Vercel и `.env.local`), подписка на район, уведомление при пересечении AQI≥101 с 6ч-кулдауном. Динамические OG-карточки и Vercel Analytics тоже готовы.
5. ✅ QA (2026-07-14): Playwright smoke 11 тестов (`pnpm e2e`, против прода — `PLAYWRIGHT_BASE_URL`; в CI отдельный job против локального `next start`, нужны 6 repo-секретов — уже добавлены). Lighthouse mobile: home 90(perf)/100(a11y после фиксов)/96/100, medeu 98/100/100/100. Скриншоты `docs/screenshots/` (регенерация: `node scripts/screenshots.mjs`, headed). Adversarial-ревью фаз 3-4: 5 находок исправлено (allowlist push-эндпоинтов, кап подписок 5000, unsubscribe с доказательством владения, guard payload в SW, ISR для OG-роутов). Остаток: включить Web Analytics тумблером в дашборде Vercel (данные не собираются без этого), GIF для README (нет ffmpeg — опционально).

## Шаги только для владельца (D8)

OpenAQ-ключ, WAQI-токен (+письмо их команде до публичного анонса), финальная проверка PWA на телефоне.

@AGENTS.md
