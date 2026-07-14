/**
 * Тесты стража сборки: полный отказ источников должен ронять `next build`
 * (красная сборка вместо запечённого на час ISR ErrorState), но не рантайм.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertSourcesUpDuringBuild } from '../build-guard';
import type { SourceId, SourceStatus } from '../types';

function failed(id: SourceId, detail?: string): SourceStatus {
  return { id, configured: true, ok: false, stations: 0, detail };
}

function ok(id: SourceId, stations = 1): SourceStatus {
  return { id, configured: true, ok: true, stations };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertSourcesUpDuringBuild', () => {
  it('во время next build при полном отказе бросает с деталями по каждому источнику', () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const sources = [
      failed('openaq', 'HTTP 500'),
      failed('waqi'),
      failed('openmeteo', 'timeout'),
    ];

    expect(() => assertSourcesUpDuringBuild(sources, 'главная страница')).toThrowError(
      /главная страница.*openaq: HTTP 500; waqi: ошибка без деталей; openmeteo: timeout/,
    );
  });

  it('во время next build не бросает, если хотя бы один источник жив', () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const sources = [failed('openaq', 'HTTP 500'), failed('waqi'), ok('openmeteo', 8)];

    expect(() => assertSourcesUpDuringBuild(sources, 'главная страница')).not.toThrow();
  });

  it('в рантайме (без NEXT_PHASE) полный отказ не бросает — страница честно показывает ошибку', () => {
    vi.stubEnv('NEXT_PHASE', undefined);
    const sources = [failed('openaq'), failed('waqi'), failed('openmeteo')];

    expect(() => assertSourcesUpDuringBuild(sources, 'район Медеуский')).not.toThrow();
  });

  it('в других фазах Next (dev-сервер) тоже не бросает', () => {
    vi.stubEnv('NEXT_PHASE', 'phase-development-server');
    const sources = [failed('openaq'), failed('waqi'), failed('openmeteo')];

    expect(() => assertSourcesUpDuringBuild(sources, 'район Медеуский')).not.toThrow();
  });
});
