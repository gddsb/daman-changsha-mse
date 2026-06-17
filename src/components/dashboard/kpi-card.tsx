'use client';

import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number; // 用于趋势图标
  deltaText?: string; // 详细说明文字
  tone?: Tone;
  icon?: ReactNode;
}

const TONE_CLASS: Record<Tone, { ring: string; text: string; accent: string }> = {
  default: { ring: 'border-border/60', text: 'text-foreground', accent: 'text-muted-foreground' },
  success: { ring: 'border-emerald-500/30', text: 'text-emerald-300', accent: 'text-emerald-400' },
  warning: { ring: 'border-amber-500/40', text: 'text-amber-300', accent: 'text-amber-400' },
  danger: { ring: 'border-rose-500/30', text: 'text-rose-300', accent: 'text-rose-400' },
  info: { ring: 'border-sky-500/30', text: 'text-sky-300', accent: 'text-sky-400' },
};

export function KpiCard({ label, value, unit, delta, deltaText, tone = 'default', icon }: KpiCardProps) {
  const cfg = TONE_CLASS[tone];
  const trendIcon = delta === undefined ? null : delta > 0 ? (
    <ArrowUp className="h-3 w-3" />
  ) : delta < 0 ? (
    <ArrowDown className="h-3 w-3" />
  ) : (
    <Minus className="h-3 w-3" />
  );
  return (
    <div className={cn('flex flex-col gap-2 border bg-card/40 p-4 backdrop-blur', cfg.ring)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        {trendIcon && (
          <div className={cn('flex items-center text-xs', cfg.accent)}>{trendIcon}</div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className={cn('font-mono text-3xl font-semibold tabular-nums', cfg.text)}>
          {value}
        </div>
        {unit && <div className="text-sm text-muted-foreground">{unit}</div>}
      </div>
      {deltaText && <div className="text-[11px] text-muted-foreground">{deltaText}</div>}
    </div>
  );
}
