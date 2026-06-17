'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  ShieldCheck,
  RefreshCcw,
  FileBarChart,
  Settings,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: '生产看板', icon: LayoutDashboard, exact: true },
  { href: '/work-orders', label: '工单管理', icon: ClipboardList },
  { href: '/production-plan', label: '七天计划', icon: CalendarRange },
  { href: '/quality-inspection', label: '质量检验', icon: ShieldCheck },
  { href: '/quality-report', label: '质量日报', icon: FileBarChart },
];

export function Sidebar() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    : '— — — — — — — — — — —';

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo 区 */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <img
          src="/logo.gif"
          alt="长沙大满"
          className="h-9 w-auto"
        />
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground leading-tight">长沙大满</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
            Production System
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex h-9 items-center gap-3 px-3 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={1.5}
              />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部状态 */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs text-muted-foreground">系统在线</span>
        </div>
        <div className="mt-2 font-mono text-xs text-foreground/80 tabular-nums">
          {timeStr}
        </div>
      </div>
    </aside>
  );
}
