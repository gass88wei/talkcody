import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

declare const document: Document;

describe('useTheme', () => {
  let setMock: ReturnType<typeof vi.fn>;
  let getMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setMock = vi.fn();
    getMock = vi.fn();

    vi.resetModules();

    // jsdom does not implement matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.doMock('@/stores/settings-store', () => ({
      settingsManager: {
        set: setMock,
        get: getMock,
      },
    }));

    // re-import after mocks
    const mod = await import('./use-theme');
    Object.assign(globalThis, { useTheme: mod.useTheme });

    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.className = '';
    vi.clearAllMocks();
  });

  it('applies saved light theme on init', async () => {
    getMock.mockResolvedValueOnce('light');

    const { useTheme } = await import('./use-theme');
    const { result } = renderHook(() => useTheme());

    await act(async () => {});

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('toggleTheme switches between light and dark', async () => {
    getMock.mockResolvedValueOnce('light');

    const { useTheme } = await import('./use-theme');
    const { result } = renderHook(() => useTheme());
    await act(async () => {});

    await act(async () => {
      result.current.toggleTheme();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(setMock).toHaveBeenCalledWith('theme', 'dark');
  });
});
