"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { OutputTrendChart } from '@/components/dashboard/output-trend-chart';
import { EquipmentMatrix } from '@/components/dashboard/equipment-matrix';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, CircleAlert, Cog, Factory, RefreshCcw, ShieldCheck, Timer } from 'lucide-react';
import { formatNumber, formatPercent, formatRelativeTime } from '@/lib/format';
import type { DashboardSummary, WorkOrder } from '@/types/mes';

export function DashboardView() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState<string>('');

  useEffect(() => {
    setNow(new Date().toLocaleString('zh-CN', { hour12: false }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled && json.success) setData(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard/refresh', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = useMemo(() => {
    if (!data) return null;
    return [
      {
        label: '今日计划产量',
        value: data.today.plannedQty,
        unit: '件',
        delta: data.today.delta,
        deltaText: `日环比 ${data.today.delta >= 0 ? '+' : ''}${formatNumber(data.today.delta)}`,
        tone: 'default' as const,
        icon: <Factory className="h-4 w-4" />,
      },
      {
        label: '今日已完工',
        value: data.today.completedQty,
        unit: '件',
        delta: data.today.completedQty,
        deltaText: `完成率 ${formatPercent(data.today.completionRate)}`,
        tone: 'success' as const,
        icon: <ShieldCheck className="h-4 w-4" />,
      },
      {
        label: '设备综合效率',
        value: data.equipment.oee,
        unit: '%',
        delta: data.equipment.oee,
        deltaText: `稼动 ${formatPercent(data.equipment.availability)} · 性能 ${formatPercent(data.equipment.performance)} · 良品 ${formatPercent(data.equipment.quality)}`,
        tone: (data.equipment.oee >= 75 ? 'success' : data.equipment.oee >= 60 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
        icon: <Cog className="h-4 w-4" />,
      },
      {
        label: '不良率',
        value: data.quality.defectRate,
        unit: '%',
        delta: data.quality.defectRate,
        deltaText: `不良 ${data.quality.defectCount} 件 · 检验 ${data.quality.inspectionCount} 次`,
        tone: (data.quality.defectRate <= 1.5 ? 'success' : data.quality.defectRate <= 3 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
        icon: <CircleAlert className="h-4 w-4" />,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">生产管控中心</h1>
            <span className="text-[10px] uppercase tracking-widest text-amber-500/80">live</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">实时数据 · 30 秒自动刷新 · {now || '正在加载当前时间'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            手动刷新
          </Button>
          <Button size="sm" onClick={() => router.push('/work-orders')}>
            进入工单
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis ? (
          kpis.map((k) => <KpiCard key={k.label} {...k} />)
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-card/40 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">近 7 日产量趋势</CardTitle>
              <p className="text-xs text-muted-foreground">计划 vs 实绩 · 单位:件</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-amber-500" />计划</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-emerald-500" />实绩</span>
            </div>
          </CardHeader>
          <CardContent>
            {data ? (
              <OutputTrendChart data={data.outputTrend} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">设备状态矩阵</CardTitle>
            <p className="text-xs text-muted-foreground">
              共 {data?.equipment.total ?? '--'} 台 · 运行 {data?.equipment.running ?? '--'} 台
            </p>
          </CardHeader>
          <CardContent>
            {data ? <EquipmentMatrix equipment={data.equipmentMatrix} /> : <Skeleton className="h-64" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/40 backdrop-blur lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">进行中工单</CardTitle>
              <p className="text-xs text-muted-foreground">点击工单号查看详情与报工</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/work-orders')}>
              全部 <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : data && data.activeWorkOrders.length > 0 ? (
              <div className="space-y-3">
                {data.activeWorkOrders.map((wo) => (
                  <WorkOrderRow key={wo.id} wo={wo} onClick={() => router.push(`/work-orders/${wo.id}`)} />
                ))}
              </div>
            ) : (
              <EmptyHint text="当前没有进行中的工单" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">质量异常</CardTitle>
            <p className="text-xs text-muted-foreground">近 24 小时不良记录</p>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="首检合格率" value={formatPercent(data.quality.firstPassRate)} tone={data.quality.firstPassRate >= 95 ? 'success' : 'warning'} />
                  <MiniStat label="检验次数" value={data.quality.inspectionCount.toString()} tone="default" />
                  <MiniStat label="不良数" value={data.quality.defectCount.toString()} tone={data.quality.defectCount > 0 ? 'danger' : 'default'} />
                </div>
                {data.recentDefects.length === 0 ? (
                  <EmptyHint text="暂无不良记录" />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.recentDefects.map((d) => (
                      <li key={d.id} className="flex items-start gap-2 border-l-2 border-rose-500/70 bg-rose-500/5 px-3 py-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-xs text-rose-300">{d.inspection_no}</span>
                            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(d.inspection_time)}</span>
                          </div>
                          <div className="truncate text-xs text-foreground/80">{d.product_name} · {d.defect_description || d.defect_code || '不良'}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Skeleton className="h-64" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkOrderRow({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  return (
    <button
      onClick={onClick}
      className="group w-full border border-border/40 bg-background/40 p-3 text-left transition hover:border-amber-500/60 hover:bg-background/70"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-amber-400">{wo.order_no}</span>
            <StatusBadge kind="workOrder" value={wo.status} />
          </div>
          <div className="mt-1 truncate text-sm">{wo.product_name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {wo.workshop || '未排车间'} · 来源 SO: <span className="font-mono">{wo.sales_order_no}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg leading-none text-foreground">
            {wo.completed_quantity}<span className="text-xs text-muted-foreground">/{wo.quantity}</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">完成率</div>
        </div>
      </div>
      <ProgressBar value={rate} className="mt-3" />
    </button>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  }[tone];
  return (
    <div className="border border-border/40 bg-background/40 p-2">
      <div className={`font-mono text-lg ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
      <Timer className="h-5 w-5 opacity-40" />
      {text}
    </div>
  );
}
