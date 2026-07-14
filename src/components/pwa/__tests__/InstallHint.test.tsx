// @vitest-environment jsdom
/**
 * Тесты подсказки установки PWA: не показывается в standalone и после
 * скрытия; на iOS — инструкция «Поделиться → На экран „Домой“»;
 * на прочих сенсорных устройствах — кнопка после beforeinstallprompt.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallHint } from '../InstallHint';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const DISMISS_KEY = 'almaty-air-install-hint-dismissed';

/** Стаб matchMedia: jsdom его не реализует. */
function stubMatchMedia(matching: Record<string, boolean>) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({ matches: matching[query] ?? false, media: query }) as MediaQueryList,
  });
}

function stubUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: ua,
  });
}

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

beforeEach(() => {
  window.localStorage.clear();
  stubMatchMedia({});
});

afterEach(cleanup);

describe('InstallHint', () => {
  it('не показывается в standalone-режиме', () => {
    stubUserAgent(IOS_UA);
    stubMatchMedia({ '(display-mode: standalone)': true });
    render(<InstallHint />);
    expect(screen.queryByText('Установите приложение')).toBeNull();
  });

  it('не показывается после скрытия (localStorage)', () => {
    stubUserAgent(IOS_UA);
    window.localStorage.setItem(DISMISS_KEY, '1');
    render(<InstallHint />);
    expect(screen.queryByText('Установите приложение')).toBeNull();
  });

  it('iOS: показывает инструкцию про «Поделиться» и экран «Домой»', () => {
    stubUserAgent(IOS_UA);
    render(<InstallHint />);
    expect(screen.getByText('Установите приложение')).toBeTruthy();
    expect(screen.getByText(/«Поделиться»/)).toBeTruthy();
    expect(screen.getByText(/Домой/)).toBeTruthy();
    // Кнопки установки на iOS нет — beforeinstallprompt не поддерживается.
    expect(screen.queryByRole('button', { name: 'Установить приложение' })).toBeNull();
  });

  it('Android: кнопка появляется после beforeinstallprompt и зовёт prompt()', async () => {
    stubUserAgent(ANDROID_UA);
    stubMatchMedia({ '(pointer: coarse)': true });
    render(<InstallHint />);
    // До события браузера подсказки нет.
    expect(screen.queryByText('Установите приложение')).toBeNull();

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: promptFn,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
    });
    act(() => {
      window.dispatchEvent(event);
    });

    const button = screen.getByRole('button', {
      name: 'Установить приложение',
    });
    await act(async () => {
      button.click();
    });
    expect(promptFn).toHaveBeenCalledTimes(1);
    // После нативного диалога подсказка скрыта.
    expect(screen.queryByText('Установите приложение')).toBeNull();
  });

  it('кнопка «Скрыть» прячет подсказку и запоминает выбор', () => {
    stubUserAgent(IOS_UA);
    render(<InstallHint />);
    act(() => {
      screen
        .getByRole('button', { name: 'Скрыть подсказку об установке' })
        .click();
    });
    expect(screen.queryByText('Установите приложение')).toBeNull();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });
});
