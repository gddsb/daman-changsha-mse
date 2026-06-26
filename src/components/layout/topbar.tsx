'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, ChevronRight, RefreshCcw } from 'lucide-react';
import { ThemeSwitcher } from './theme-switcher';

const TITLE_MAP: Record<string, string> = {
  '/': '生产看板',
  '/work-orders': '工单管理',
  '/production-plan': '七天生产计划',
  '/quality': '质量检验',
  '/quality-report': '质量日报',
  '/u9': 'U9 数据接入',
};

export function Topbar() {
  const pathname = usePathname() || '/';
  const title = TITLE_MAP[pathname] ?? (pathname.startsWith('/work-orders') ? '工单详情' : pathname);
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const handleU9Sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/u9/sales-orders', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMsg(`已同步 ${json.data.syncedCount} 张销售订单`);
        setTimeout(() => setSyncMsg(null), 3000);
        // 触发自定义事件，通知看板/工单页刷新
        window.dispatchEvent(new CustomEvent('mes:data-changed'));
      } else {
        setSyncMsg(`同步失败: ${json.error}`);
      }
    } catch (e) {
      setSyncMsg('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">长沙大满生产管理系统</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="font-semibold text-foreground">{title}</span>
      </div>

      {/* 右侧操作 */}
      <div className="flex items-center gap-3">
        {syncMsg && (
          <span className="text-xs text-success">{syncMsg}</span>
        )}
        <button
          onClick={handleU9Sync}
          disabled={syncing}
          className="flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/60 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '同步 U9'}
        </button>
        <ThemeSwitcher />
        <div className="hidden items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>搜索工单 / 设备 / 物料</span>
          <kbd className="ml-2 border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </div>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-destructive" />
        </button>
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <div className="flex h-7 w-7 items-center justify-center bg-secondary text-xs font-medium text-foreground">
            调
          </div>
          <div className="hidden text-xs md:block">
            <div className="font-medium text-foreground leading-tight">当班调度</div>
            <div className="text-muted-foreground leading-tight">夜班 · A 组</div>
          </div>
        </div>
      </div>
    </header>
  );
}
