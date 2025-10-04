/**
 * @jest-environment jsdom
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ThemeProvider, useTheme } from '@/context/theme-provider';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThemeProvider', () => {

  let container: HTMLDivElement;
  let root: Root;
  let toggleTheme: (() => void) | undefined;

  const ThemeConsumer = () => {
    const { theme, toggleTheme: toggle } = useTheme();
    toggleTheme = toggle;

    return <span data-testid="theme-value">{theme}</span>;
  };

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);

    act(() => {
      root = createRoot(container);
      root.render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('toggles the theme and persists exactly once per toggle', () => {
    const themeDisplay = container.querySelector('[data-testid="theme-value"]');
    expect(themeDisplay?.textContent).toBe('light');
    expect(localStorage.getItem('theme')).toBeNull();

    const setItemSpy = jest.spyOn(window.localStorage.__proto__, 'setItem');

    const invokeToggle = () => {
      if (!toggleTheme) {
        throw new Error('toggleTheme not initialized');
      }
      toggleTheme();
    };

    act(() => {
      invokeToggle();
    });

    expect(themeDisplay?.textContent).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenLastCalledWith('theme', 'dark');

    act(() => {
      invokeToggle();
    });

    expect(themeDisplay?.textContent).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(setItemSpy).toHaveBeenCalledTimes(2);
    expect(setItemSpy).toHaveBeenLastCalledWith('theme', 'light');

    setItemSpy.mockRestore();
  });
});
