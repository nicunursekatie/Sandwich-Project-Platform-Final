import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme';

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const readStoredTheme = (): Theme | undefined => {
  if (typeof window === 'undefined') return undefined;
  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(storedValue) ? storedValue : undefined;
};

const persistTheme = (value: Theme) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Silently ignore storage errors (e.g., private mode)
  }
};

// Theme definitions mapping CSS variables to values
const themes: Record<Theme, Record<string, string>> = {
  light: {
    '--color-primary': '197 53% 32%',
    '--color-primary-hover': '197 53% 28%',
    '--color-brand-primary': '#236383',
    '--color-brand-secondary': '#FBAD3F',
    '--color-brand-accent': '#A31C41',
    '--color-brand-muted': '#007E8C',
    '--color-brand-teal': '#236383',
    '--color-brand-teal-light': '#f0f9ff',
    '--color-brand-teal-hover': '#1a4e66',
    '--color-brand-teal-dark': '#004F59',
  },
  dark: {
    '--color-primary': '210 40% 98%',
    '--color-primary-hover': '210 40% 90%',
    '--color-brand-primary': '#47B3CB',
    '--color-brand-secondary': '#E89A2F',
    '--color-brand-accent': '#FB6C85',
    '--color-brand-muted': '#006B75',
    '--color-brand-teal': '#47B3CB',
    '--color-brand-teal-light': '#1a4e66',
    '--color-brand-teal-hover': '#63cce2',
    '--color-brand-teal-dark': '#005f6b',
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars = themes[theme];
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState((currentTheme) => {
      if (currentTheme === newTheme) {
        return currentTheme;
      }
      return newTheme;
    });
    persistTheme(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

export const themeValues = themes;

