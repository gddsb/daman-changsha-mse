'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId = 'mes-dark' | 'mes-cyan' | 'mes-emerald' | 'mes-crimson' | 'mes-amber';
export type ThemeMode = 'light' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  /** 主色十六进制，用于 topbar 切换器中的色点 */
  swatch: string;
  /** 切换器中的描述 */
  description: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'mes-dark',    name: '工业橙',  swatch: '#F97316', description: '默认 · 长沙大满品牌' },
  { id: 'mes-cyan',    name: '冰蓝',    swatch: '#38BDF8', description: '冷静 · 洁净车间' },
  { id: 'mes-emerald', name: '翡翠',    swatch: '#10B981', description: '安全 · 合规运行' },
  { id: 'mes-crimson', name: '朱红',    swatch: '#F43F5E', description: '警示 · 异常高亮' },
  { id: 'mes-amber',   name: '琥珀',    swatch: '#F59E0B', description: '稳重 · 厂长值班' },
];

const THEME_STORAGE_KEY = 'mes:theme';
const MODE_STORAGE_KEY = 'mes:mode';
const DEFAULT_THEME: ThemeId = 'mes-dark';
const DEFAULT_MODE: ThemeMode = 'dark';

interface ThemeContextValue {
  theme: ThemeId;
  mode: ThemeMode;
  setTheme: (id: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
        setThemeState(savedTheme);
      }
      const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null;
      if (savedMode === 'light' || savedMode === 'dark') {
        setModeState(savedMode);
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    // 同步 Tailwind dark class
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* 忽略 */
    }
  }, [theme, mode, hydrated]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, mode, setTheme, setMode, toggleMode }), [theme, mode, setTheme, setMode, toggleMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
