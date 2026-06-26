'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeSwitcher() {
  const { mode, toggleMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggleMode}
      title={mode === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
      className="flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
    >
      {mounted && (mode === 'dark' ? (
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.5} />
      ))}
      <span className="font-medium">{mounted ? (mode === 'dark' ? '暗色' : '亮色') : '主题'}</span>
    </button>
  );
}