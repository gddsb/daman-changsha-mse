'use client';

import { useEffect, useRef, useState } from 'react';
import { Palette, Check, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEMES, useTheme } from './theme-provider';

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="flex items-center gap-1.5">
      {/* 深色/浅色切换按钮 */}
      <button
        type="button"
        onClick={toggleMode}
        title={mounted ? (mode === 'dark' ? '切换为浅色模式' : '切换为深色模式') : '切换明暗模式'}
        className="flex items-center justify-center h-8 w-8 border border-border bg-card text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
      >
        {mounted ? (
          mode === 'dark' ? <Sun className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
        ) : (
          <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        )}
      </button>

      {/* 配色方案选择器 */}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="切换主题"
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
        >
          <span
            className="h-3 w-3 rounded-sm border border-border"
            style={{ backgroundColor: mounted ? current.swatch : '#F97316' }}
            aria-hidden
          />
          <Palette className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="font-medium">{mounted ? current.name : '主题'}</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 border border-border bg-card shadow-2xl"
          >
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              选择配色方案
            </div>
            <ul className="py-1">
              {THEMES.map((t) => {
                const active = t.id === theme;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme(t.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition',
                        active
                          ? 'bg-sidebar-primary/10 text-sidebar-primary'
                          : 'text-foreground hover:bg-sidebar-accent',
                      )}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-sm border border-border"
                        style={{ backgroundColor: t.swatch }}
                        aria-hidden
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-foreground">{t.name}</span>
                        <span className="block text-[10px] text-muted-foreground">{t.description}</span>
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-sidebar-primary" strokeWidth={2} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
