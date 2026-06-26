'use client';

import { cn } from '@/lib/utils';
import {
  WORK_ORDER_STATUS,
  EQUIPMENT_STATUS,
  OPERATION_STATUS,
  INSPECTION_TYPE,
  INSPECTION_RESULT,
  REPORT_TYPE,
  MAINTENANCE_STATUS,
} from '@/lib/constants';

export type BadgeKind =
  | 'workOrder'
  | 'equipment'
  | 'operation'
  | 'inspectionType'
  | 'qualityResult'
  | 'reportType'
  | 'maintenanceStatus';

interface StatusBadgeProps {
  kind: BadgeKind;
  value: string;
  className?: string;
  size?: 'sm' | 'md';
}

function resolveLabel(kind: BadgeKind, value: string): string {
  switch (kind) {
    case 'workOrder':
      return WORK_ORDER_STATUS[value as keyof typeof WORK_ORDER_STATUS] ?? value;
    case 'equipment':
      return EQUIPMENT_STATUS[value as keyof typeof EQUIPMENT_STATUS] ?? value;
    case 'operation':
      return OPERATION_STATUS[value as keyof typeof OPERATION_STATUS] ?? value;
    case 'inspectionType':
      return INSPECTION_TYPE[value as keyof typeof INSPECTION_TYPE] ?? value;
    case 'qualityResult':
      return INSPECTION_RESULT[value as keyof typeof INSPECTION_RESULT] ?? value;
    case 'reportType':
      return REPORT_TYPE[value as keyof typeof REPORT_TYPE] ?? value;
    case 'maintenanceStatus':
      return MAINTENANCE_STATUS[value as keyof typeof MAINTENANCE_STATUS] ?? value;
  }
}

const TONE_MAP: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  // 偏中性的状态
  neutral: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border' },
  // 蓝色/信息
  info: { dot: 'bg-info', text: 'text-info', bg: 'bg-info/10', border: 'border-info/30' },
  // 绿色/正常/合格
  success: { dot: 'bg-success', text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  // 黄色/警告/暂停/让步
  warning: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  // 红色/危险/不良/故障
  danger: { dot: 'bg-destructive', text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
};

function toneFor(kind: BadgeKind, value: string): keyof typeof TONE_MAP {
  switch (kind) {
    case 'workOrder':
      if (value === 'planned' || value === 'released') return 'info';
      if (value === 'in_progress') return 'success';
      if (value === 'paused') return 'warning';
      if (value === 'completed' || value === 'closed') return 'neutral';
      return 'neutral';
    case 'equipment':
      if (value === 'running') return 'success';
      if (value === 'idle' || value === 'offline') return 'info';
      if (value === 'maintenance') return 'warning';
      if (value === 'breakdown') return 'danger';
      return 'neutral';
    case 'operation':
      if (value === 'pending') return 'neutral';
      if (value === 'in_progress') return 'success';
      if (value === 'completed') return 'info';
      if (value === 'paused') return 'warning';
      return 'neutral';
    case 'inspectionType':
      if (value === 'first') return 'info';
      if (value === 'in_process') return 'warning';
      if (value === 'final' || value === 'incoming') return 'neutral';
      return 'neutral';
    case 'qualityResult':
      if (value === 'pass') return 'success';
      if (value === 'fail') return 'danger';
      if (value === 'conditional') return 'warning';
      return 'neutral';
    case 'reportType':
      if (value === 'start' || value === 'production') return 'success';
      if (value === 'pause') return 'warning';
      if (value === 'resume') return 'info';
      if (value === 'complete') return 'neutral';
      return 'neutral';
    case 'maintenanceStatus':
      if (value === 'planned') return 'info';
      if (value === 'in_progress') return 'warning';
      if (value === 'completed') return 'success';
      if (value === 'overdue') return 'danger';
      if (value === 'cancelled') return 'neutral';
      return 'neutral';
  }
}

export function StatusBadge({ kind, value, className, size = 'md' }: StatusBadgeProps) {
  const tone = TONE_MAP[toneFor(kind, value)];
  const label = resolveLabel(kind, value);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border font-medium uppercase tracking-wide',
        tone.bg,
        tone.text,
        tone.border,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      {label}
    </span>
  );
}
