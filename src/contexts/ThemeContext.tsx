import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  readAppearance, writeAppearance, applyAppearance, DEFAULT_APPEARANCE, normalizeHex,
  type Appearance, type PaletteId,
} from '../utils/themePalettes';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Colour palette + optional custom accent (see utils/themePalettes). Independent of light/dark mode. */
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  /** Back to the MFU Original palette, no custom accent, and the default mode (follow system). */
  resetAppearance: () => void;
}

const DEFAULT_MODE: Theme = 'system';

/** Runs before React renders so the saved palette is in place on first paint (no flash of the default). */
export const bootstrapTheme = (): void => {
  try {
    const saved = localStorage.getItem('theme');
    const mode: Theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_MODE;
    const dark = mode === 'dark' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    applyAppearance(dark ? 'dark' : 'light', readAppearance());
  } catch { /* storage/matchMedia unavailable — stylesheet defaults apply */ }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return DEFAULT_MODE;
  });
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);

  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === 'system') return getSystemTheme();
    return theme;
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const setAppearance = useCallback((a: Appearance) => {
    const clean: Appearance = { palette: a.palette as PaletteId, accent: a.accent ? normalizeHex(a.accent) : null };
    setAppearanceState(clean);
    writeAppearance(clean);
  }, []);

  const resetAppearance = useCallback(() => {
    setAppearanceState(DEFAULT_APPEARANCE);
    writeAppearance(DEFAULT_APPEARANCE);
    setThemeState(DEFAULT_MODE);
    localStorage.setItem('theme', DEFAULT_MODE);
  }, []);

  // One place that turns (mode, palette, accent) into CSS variables on <html>.
  useEffect(() => {
    applyAppearance(resolvedTheme, appearance);
  }, [resolvedTheme, appearance]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateResolvedTheme = () => {
      const resolved = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateResolvedTheme();

    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, appearance, setAppearance, resetAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
};
