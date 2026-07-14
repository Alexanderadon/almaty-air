import type { SourceStatus } from './types';

/** Человекочитаемая сводка статусов источников для сообщения об ошибке сборки. */
function describeSources(sources: SourceStatus[]): string {
  return sources
    .map((s) => `${s.id}: ${s.detail ?? (s.ok ? 'ok' : 'ошибка без деталей')}`)
    .join('; ');
}

/**
 * Во время `next build` полный отказ всех источников должен ронять сборку,
 * а не молча запекать страницу ошибки в статику на час ISR: зелёный деплой
 * с ErrorState неотличим от нормального. В рантайме (ISR-регенерация)
 * ничего не бросает — страницы честно показывают ErrorState / «Нет данных».
 */
export function assertSourcesUpDuringBuild(sources: SourceStatus[], page: string): void {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return;
  if (sources.some((s) => s.ok)) return;
  throw new Error(
    `Все источники данных недоступны во время сборки (${page}): ${describeSources(sources)}`,
  );
}
