'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'success' | 'warning' | 'destructive' | 'info' | 'primary' | 'auto';
  showLabel?: boolean;
  height?: number;
  className?: string;
}

const VARIANT_CLASS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  auto: 'bg-warning',
};

export function ProgressBar({
  value,
  variant = 'auto',
  showLabel = false,
  height = 6,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));

  // auto: 根据完成度变色（>90 绿，>60 黄，否则红色）
  const resolvedVariant =
    variant === 'auto'
      ? pct >= 90
        ? 'success'
        : pct >= 30
        ? 'warning'
        : 'destructive'
      : variant;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="w-full overflow-hidden border border-border/30 bg-muted/40"
        style={{ height: `${height}px` }}
      >
        <div
          className={cn('h-full transition-all', VARIANT_CLASS[resolvedVariant])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
          {pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}