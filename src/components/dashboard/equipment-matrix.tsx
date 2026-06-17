'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, Wrench, Pause, Play, PowerOff } from 'lucide-react';
import type { EquipmentMatrixItem } from '@/types/mes';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Play; label: string }> = {
  running: { color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/40', icon: Play, label: '运行' },
  idle: { color: 'text-sky-400', bg: 'bg-sky-500/5', border: 'border-sky-500/40', icon: Pause, label: '待机' },
  maintenance: { color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/40', icon: Wrench, label: '维保' },
  breakdown: { color: 'text-rose-400', bg: 'bg-rose-500/5', border: 'border-rose-500/40', icon: AlertCircle, label: '故障' },
  offline: { color: 'text-zinc-500', bg: 'bg-zinc-500/5', border: 'border-zinc-500/40', icon: PowerOff, label: '离线' },
};

const DEFAULT = STATUS_CONFIG.idle!;

export function EquipmentMatrix({ equipment }: { equipment: EquipmentMatrixItem[] }) {
  if (equipment.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        暂无设备数据
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
      {equipment.map((eq) => {
        const cfg = STATUS_CONFIG[eq.status] ?? DEFAULT;
        const Icon = cfg.icon;
        return (
          <div
            key={eq.id}
            className={cn('group flex flex-col gap-1.5 border bg-card/40 p-2.5 transition-colors hover:border-amber-500/60', cfg.bg, cfg.border)}
            title={`${eq.name} · ${eq.workshop ?? ''}`}
          >
            <div className="flex items-center justify-between">
              <Icon className={cn('h-3.5 w-3.5', cfg.color)} strokeWidth={2} />
              <span className={cn('text-[10px] font-medium uppercase tracking-wider', cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">{eq.code}</div>
              <div className="truncate text-xs font-medium text-foreground">{eq.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
