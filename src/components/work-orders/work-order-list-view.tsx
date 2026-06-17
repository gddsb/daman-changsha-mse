"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import { Search, RefreshCcw, Plus, ClipboardList } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/format';
import { WORK_ORDER_STATUS_OPTIONS, WORK_ORDER_PRIORITY_OPTIONS } from '@/lib/constants';
import type { WorkOrder } from '@/types/mes';

export function WorkOrderListView() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/work-orders', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && String(o.priority) !== priorityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          o.order_no.toLowerCase().includes(s) ||
          (o.sales_order_no || '').toLowerCase().includes(s) ||
          o.product_code.toLowerCase().includes(s) ||
          o.product_name.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [orders, search, statusFilter, priorityFilter]);

  const summary = useMemo(() => {
    if (!orders) return null;
    return {
      total: orders.length,
      planned: orders.filter((o) => o.status === 'planned').length,
      released: orders.filter((o) => o.status === 'released').length,
      inProgress: orders.filter((o) => o.status === 'in_progress').length,
      completed: orders.filter((o) => o.status === 'completed' || o.status === 'closed').length,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">工单管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">工单下发、派工、报工、进度跟踪</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />刷新
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCell label="工单总数" value={summary.total} tone="default" />
          <SummaryCell label="计划中" value={summary.planned} tone="info" />
          <SummaryCell label="已下发" value={summary.released} tone="info" />
          <SummaryCell label="生产中" value={summary.inProgress} tone="warning" />
          <SummaryCell label="已完成" value={summary.completed} tone="success" />
        </div>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索工单号 / 销售订单号 / 料号 / 料名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="全部" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              {WORK_ORDER_STATUS_OPTIONS.map((s) => (
                <FilterChip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="所有优先级" active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} />
              {WORK_ORDER_PRIORITY_OPTIONS.map((p) => (
                <FilterChip key={p.value} label={`P${p.value}`} active={priorityFilter === String(p.value)} onClick={() => setPriorityFilter(String(p.value))} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ClipboardList className="h-8 w-8 opacity-30" />
            <p className="text-sm">没有符合条件的工单</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((wo) => (
            <WorkOrderCard key={wo.id} wo={wo} onClick={() => router.push(`/work-orders/${wo.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkOrderCard({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  return (
    <button
      onClick={onClick}
      className="group border border-border/40 bg-card/40 p-4 text-left transition hover:border-amber-500/60 hover:bg-card/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-amber-400">{wo.order_no}</span>
            <StatusBadge kind="workOrder" value={wo.status} />
            <span className="rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">P{wo.priority}</span>
          </div>
          <div className="mt-2 truncate text-base font-medium">{wo.product_name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{wo.product_code}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl leading-none text-foreground">{formatNumber(wo.completed_quantity)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/ {formatNumber(wo.quantity)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div>车间: <span className="text-foreground/80">{wo.workshop || '-'}</span></div>
        <div>车间: <span className="text-foreground/80">{wo.workshop || '-'}</span></div>
        <div>来源SO: <span className="font-mono text-foreground/80">{wo.sales_order_no || '-'}</span></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div>计划: <span className="text-foreground/80">{formatDate(wo.planned_start_date)} ~ {formatDate(wo.planned_end_date)}</span></div>
        <div>不良: <span className="text-rose-400">{wo.scrap_quantity}</span></div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>完工率</span>
          <span className="font-mono">{rate.toFixed(1)}%</span>
        </div>
        <ProgressBar value={rate} />
      </div>
    </button>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: number; tone: 'default' | 'info' | 'warning' | 'success' }) {
  const toneClass = {
    default: 'text-foreground',
    info: 'text-sky-400',
    warning: 'text-amber-400',
    success: 'text-emerald-400',
  }[tone];
  return (
    <div className="border border-border/40 bg-card/40 p-3">
      <div className={`font-mono text-2xl ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-3 py-1 text-xs transition ${
        active
          ? 'border-amber-500/80 bg-amber-500/10 text-amber-300'
          : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
