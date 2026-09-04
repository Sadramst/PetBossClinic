'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemePreset, THEME_PRESETS, ThemeOption } from './types';

interface ThemeContextValue {
  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;
  presets: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_COOKIE_NAME = 'petboss_theme';
const DEFAULT_THEME: ThemePreset = 'petboss-luxury-dark';

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
}: {
  children: React.ReactNode;
  initialTheme?: ThemePreset;
}) {
  const [theme, setThemeState] = useState<ThemePreset>(initialTheme);

  useEffect(() => {
    // Load from localStorage if present
    const saved = localStorage.getItem(THEME_COOKIE_NAME) as ThemePreset | null;
    if (saved && THEME_PRESETS.some((p) => p.id === saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
  }, [initialTheme]);

  const setTheme = (newTheme: ThemePreset) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem(THEME_COOKIE_NAME, newTheme);
      // Set cookie for 1 year
      document.cookie = `${THEME_COOKIE_NAME}=${newTheme};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      // Storage access blocked/fails gracefully
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
