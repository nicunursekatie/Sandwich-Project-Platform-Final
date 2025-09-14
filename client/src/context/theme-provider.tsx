import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Theme definitions mapping CSS variables to values
const themes: Record<Theme, Record<string, string>> = {
  light: {
    '--primary': '197 53% 32%',
    '--primary-hover': '197 53% 28%',
    '--tsp-primary': '#236383',
    '--tsp-secondary': '#FBAD3F',
    '--tsp-accent': '#A31C41',
    '--tsp-muted': '#007E8C',
    '--tsp-teal': '#236383',
    '--tsp-teal-light': '#f0f9ff',
    '--tsp-teal-hover': '#1a4e66',
    '--tsp-teal-dark': '#004F59',
  },
  dark: {
    '--primary': '210 40% 98%',
    '--primary-hover': '210 40% 90%',
    '--tsp-primary': '#47B3CB',
    '--tsp-secondary': '#E89A2F',
    '--tsp-accent': '#FB6C85',
    '--tsp-muted': '#006B75',
    '--tsp-teal': '#47B3CB',
    '--tsp-teal-light': '#1a4e66',
    '--tsp-teal-hover': '#63cce2',
    '--tsp-teal-dark': '#005f6b',
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const root = document.documentElement;
    const vars = themes[theme];
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);
  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'));

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

