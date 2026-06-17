'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  ClipboardEdit,
  CalendarRange,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  Package,
  Cog,
  AlertOctagon,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

const PRIMARY_NAV = [
  { href: '/', label: '生产看板', icon: LayoutDashboard, exact: true },
  { href: '/work-orders', label: '工单管理', icon: ClipboardList },
  { href: '/reports', label: '报工管理', icon: ClipboardEdit },
  { href: '/production-plan', label: '七天计划', icon: CalendarRange },
  { href: '/quality-inspection', label: '质量检验', icon: ShieldCheck },
];

const SETTINGS_NAV = [
  { href: '/settings/products', label: '产品信息', icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now
    ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    : '--:--:--';

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-expanded={!collapsed}
    >
      {/* Logo 区 */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}
      >
        <img src="/logo.gif" alt="长沙大满" className="h-9 w-auto shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground leading-tight">
              长沙大满
            </div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
              Production System
            </div>
          </div>
        )}
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex h-9 items-center text-sm transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={1.5}
              />
              {!collapsed && <span className="font-medium">{item.label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto h-1.5 w-1.5 bg-sidebar-primary" />
              )}
              {collapsed && isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
              )}
            </Link>
          );
        })}

        {/* 参数设置分组 */}
        {!collapsed && (
          <div className="px-3 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            参数设置
          </div>
        )}
        {collapsed && <div className="my-2 mx-2 border-t border-sidebar-border" />}
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex h-9 items-center text-sm transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={1.5}
              />
              {!collapsed && <span className="font-medium">{item.label}</span>}
              {collapsed && isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 折叠按钮 */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className={cn(
          'flex h-9 items-center border-t border-sidebar-border text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          collapsed ? 'justify-center' : 'gap-2 px-4',
        )}
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <>
            <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-xs">收起菜单</span>
          </>
        )}
      </button>

      {/* 底部状态 */}
      <div
        className={cn(
          'border-t border-sidebar-border p-3',
          collapsed ? 'flex justify-center' : '',
        )}
      >
        {collapsed ? (
          <div
            className="flex h-2 w-2 rounded-full bg-emerald-500"
            title="系统在线"
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs text-muted-foreground">系统在线</span>
            </div>
            <div className="mt-2 font-mono text-xs text-foreground/80 tabular-nums">{timeStr}</div>
          </>
        )}
      </div>
    </aside>
  );
}
