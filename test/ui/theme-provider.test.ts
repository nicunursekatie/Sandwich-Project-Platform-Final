/** @jest-environment jsdom */

import React, { useEffect } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { ThemeProvider, useTheme } from '@/context/theme-provider';

describe('ThemeProvider', () => {
  beforeAll(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('theme', 'dark');
    jest.restoreAllMocks();
  });

  it('persists only the final theme when setTheme is called rapidly', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const DispatchThemes = () => {
      const { setTheme } = useTheme();

      useEffect(() => {
        setTheme('dark');
        setTheme('light');
      }, [setTheme]);

      return null;
    };

    await act(async () => {
      root.render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(DispatchThemes, null),
        ),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith('theme', 'light');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
