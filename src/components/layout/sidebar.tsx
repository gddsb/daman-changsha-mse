'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  FileText,
  ShieldCheck,
  Package,
  Wrench,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

interface SubItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** 该一级菜单自身的路由（点击名称跳转的页面），可选 */
  rootHref?: string;
  /** 二级子项 */
  children?: SubItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'dashboard',
    label: '看板管理',
    icon: LayoutDashboard,
    rootHref: '/',
  },
  {
    key: 'production',
    label: '生产管理',
    icon: ClipboardList,
    children: [
      { href: '/work-orders', label: '工单管理', icon: ClipboardList },
      { href: '/production-plan', label: '七天计划', icon: CalendarRange },
      { href: '/reports', label: '生产报工', icon: FileText },
    ],
  },
  {
    key: 'quality',
    label: '质量管理',
    icon: ShieldCheck,
    children: [
      { href: '/quality-inspection', label: '质量检验', icon: ShieldCheck },
    ],
  },
  {
    key: 'equipment',
    label: '设备管理',
    icon: Wrench,
  },
  {
    key: 'params',
    label: '参数管理',
    icon: Package,
    children: [
      { href: '/settings/products', label: '产品信息', icon: Package },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: SettingsIcon,
  },
];

/**
 * 命中规则：
 * 1) 优先匹配二级子项的 href 前缀
 * 2) 否则匹配一级菜单的 rootHref（exact）
 * 3) 都不匹配则无激活
 */
function findActiveGroup(pathname: string | null): {
  groupKey: string;
  childHref?: string;
} {
  if (!pathname) return { groupKey: '' };
  for (const g of NAV_GROUPS) {
    if (g.children) {
      const hit = g.children.find(
        (c) => pathname === c.href || pathname.startsWith(c.href + '/')
      );
      if (hit) return { groupKey: g.key, childHref: hit.href };
    }
    if (g.rootHref) {
      if (g.rootHref === '/' ? pathname === '/' : pathname.startsWith(g.rootHref)) {
        return { groupKey: g.key };
      }
    }
  }
  return { groupKey: '' };
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [now, setNow] = useState<Date | null>(null);
  // 受控展开：用户手动展开的 key 集合
  const [manualOpen, setManualOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = useMemo(() => findActiveGroup(pathname), [pathname]);

  // 当前激活 group 默认展开（用户未手动操作时）
  const isGroupOpen = (key: string, hasChildren: boolean): boolean => {
    if (!hasChildren) return false;
    if (manualOpen.has(key)) return true;
    if (manualOpen.has(`__close_${key}`)) return false;
    return active.groupKey === key;
  };

  const toggleGroup = (key: string) => {
    setManualOpen((prev) => {
      const next = new Set(prev);
      const opened = isGroupOpen(key, true);
      // 清掉旧的 close 标记
      next.delete(`__close_${key}`);
      if (opened) {
        next.add(`__close_${key}`);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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
        {NAV_GROUPS.map((group) => {
          const Icon = group.icon;
          const hasChildren = !!group.children?.length;
          const open = isGroupOpen(group.key, hasChildren);
          const isActiveGroup = active.groupKey === group.key;

          // 折叠态：仅显示一级图标
          if (collapsed) {
            if (hasChildren) {
              return (
                <Link
                  key={group.key}
                  href={group.children![0].href}
                  title={group.label}
                  className={cn(
                    'group relative flex h-9 items-center justify-center px-2 text-sm transition-colors',
                    isActiveGroup
                      ? 'bg-sidebar-primary/10 text-sidebar-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActiveGroup
                        ? 'text-sidebar-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                    strokeWidth={1.5}
                  />
                  {isActiveGroup && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
                  )}
                </Link>
              );
            }
            if (!group.rootHref) {
              // 折叠态下无子项且无路由的菜单（如设备管理/系统管理）展示禁用样式
              return (
                <div
                  key={group.key}
                  title={group.label}
                  className="flex h-9 cursor-not-allowed items-center justify-center px-2 text-sm text-muted-foreground/50"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
              );
            }
            return (
              <Link
                key={group.key}
                href={group.rootHref}
                title={group.label}
                className={cn(
                  'group relative flex h-9 items-center justify-center px-2 text-sm transition-colors',
                  isActiveGroup
                    ? 'bg-sidebar-primary/10 text-sidebar-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActiveGroup
                      ? 'text-sidebar-primary'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                  strokeWidth={1.5}
                />
                {isActiveGroup && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-sidebar-primary" />
                )}
              </Link>
            );
          }

          // 展开态
          if (hasChildren) {
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={cn(
                    'group flex h-9 w-full items-center gap-3 px-3 text-sm transition-colors',
                    isActiveGroup
                      ? 'bg-sidebar-primary/10 text-sidebar-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActiveGroup
                        ? 'text-sidebar-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="font-medium">{group.label}</span>
                  <span className="ml-auto text-muted-foreground/70">
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                    )}
                  </span>
                </button>
                {open && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                    {group.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isActiveChild = active.childHref === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'group flex h-8 items-center gap-2.5 px-3 text-sm transition-colors',
                            isActiveChild
                              ? 'bg-sidebar-primary/10 text-sidebar-primary'
                              : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <ChildIcon
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-colors',
                              isActiveChild
                                ? 'text-sidebar-primary'
                                : 'text-muted-foreground group-hover:text-foreground',
                            )}
                            strokeWidth={1.5}
                          />
                          <span className="font-medium">{child.label}</span>
                          {isActiveChild && (
                            <span className="ml-auto h-1.5 w-1.5 bg-sidebar-primary" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // 展开态：无子项
          if (!group.rootHref) {
            // 占位（设备管理/系统管理）— 灰显，提示暂无内容
            return (
              <div
                key={group.key}
                className="flex h-9 cursor-not-allowed items-center gap-3 px-3 text-sm text-muted-foreground/50"
                title="该模块暂未开放"
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="font-medium">{group.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">待开放</span>
              </div>
            );
          }

          return (
            <Link
              key={group.key}
              href={group.rootHref}
              className={cn(
                'group flex h-9 items-center gap-3 px-3 text-sm transition-colors',
                isActiveGroup
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActiveGroup
                    ? 'text-sidebar-primary'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={1.5}
              />
              <span className="font-medium">{group.label}</span>
              {isActiveGroup && (
                <span className="ml-auto h-1.5 w-1.5 bg-sidebar-primary" />
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
