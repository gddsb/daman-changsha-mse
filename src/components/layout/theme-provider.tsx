'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeBrand = 'orange' | 'cyan' | 'emerald' | 'crimson' | 'amber';
export type ThemeMode = 'dark' | 'light';

export interface ThemeMeta {
  id: ThemeBrand;
  name: string;
  /** 主色十六进制，用于 topbar 切换器中的色点 */
  swatchDark: string;
  swatchLight: string;
  /** 切换器中的描述 */
  description: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'orange',   name: '工业橙',  swatchDark: '#F97316', swatchLight: '#EA580C', description: '默认 · 长沙大满品牌' },
  { id: 'cyan',     name: '冰蓝',    swatchDark: '#38BDF8', swatchLight: '#0284C7', description: '冷静 · 洁净车间' },
  { id: 'emerald',  name: '翡翠',    swatchDark: '#10B981', swatchLight: '#059669', description: '安全 · 合规运行' },
  { id: 'crimson',  name: '朱红',    swatchDark: '#F43F5E', swatchLight: '#E11D48', description: '警示 · 异常高亮' },
  { id: 'amber',    name: '琥珀',    swatchDark: '#F59E0B', swatchLight: '#D97706', description: '稳重 · 厂长值班' },
];

const STORAGE_KEY_THEME = 'mes:theme-brand';
const STORAGE_KEY_MODE = 'mes:theme-mode';
const DEFAULT_THEME: ThemeBrand = 'orange';
const DEFAULT_MODE: ThemeMode = 'dark';

interface ThemeContextValue {
  theme: ThemeBrand;
  mode: ThemeMode;
  setTheme: (id: ThemeBrand) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeBrand>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(STORAGE_KEY_THEME) as ThemeBrand | null;
      const savedMode = window.localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
      if (savedTheme && THEMES.some((t) => t.id === savedTheme)) {
        setThemeState(savedTheme);
      }
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
    // 构建 data-theme 值: mes-dark / mes-light / mes-cyan / mes-light-cyan 等
    const dataTheme = mode === 'dark' ? `mes-${theme}` : `mes-light-${theme}`;
    document.documentElement.setAttribute('data-theme', dataTheme);
    document.documentElement.setAttribute('data-mode', mode);
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, theme);
      window.localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {
      /* 忽略 */
    }
  }, [theme, mode, hydrated]);

  const setTheme = useCallback((id: ThemeBrand) => {
    setThemeState(id);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const value = useMemo(() => ({ theme, mode, setTheme, setMode, toggleMode }), [theme, mode, setTheme, setMode, toggleMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
