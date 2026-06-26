'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY_MODE = 'mes:theme-mode';
const DEFAULT_MODE: ThemeMode = 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
      if (savedMode === 'dark' || savedMode === 'light') {
        setModeState(savedMode);
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // 设置 data-theme 和 class
    document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'mes-dark' : 'mes-light');
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {
      /* 忽略 */
    }
  }, [mode, hydrated]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}