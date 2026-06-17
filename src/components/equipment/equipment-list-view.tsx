"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/status-badge';
import { Cog, Search, Wrench, RefreshCcw, Activity, Gauge } from 'lucide-react';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { EQUIPMENT_STATUS_OPTIONS } from '@/lib/constants';
import type { Equipment, EquipmentOEE, EquipmentMaintenance } from '@/types/mes';

type EquipmentListResponse = {
  equipment: Equipment[];
  oee: EquipmentOEE[];
  maintenance: EquipmentMaintenance[];
};

export function EquipmentListView() {
  const [data, setData] = useState<EquipmentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/equipment', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.equipment.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          e.code.toLowerCase().includes(s) ||
          e.name.toLowerCase().includes(s) ||
          (e.model || '').toLowerCase().includes(s) ||
          (e.workshop || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [data, search, statusFilter]);

  const oeeByEquipment = useMemo(() => {
    if (!data) return new Map<string, EquipmentOEE>();
    // OEE 数据按 equipment_code 索引，而非 id
    return new Map(data.oee.map((o) => [o.equipment_code, o]));
  }, [data]);

  const maintenanceByEquipment = useMemo(() => {
    if (!data) return new Map<string, EquipmentMaintenance[]>();
    const map = new Map<string, EquipmentMaintenance[]>();
    data.maintenance.forEach((m) => {
      if (!map.has(m.equipment_code)) map.set(m.equipment_code, []);
      map.get(m.equipment_code)!.push(m);
    });
    return map;
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return null;
    const total = data.equipment.length;
    const running = data.equipment.filter((e) => e.status === 'running').length;
    const idle = data.equipment.filter((e) => e.status === 'idle').length;
    const maintenance = data.equipment.filter((e) => e.status === 'maintenance').length;
    const breakdown = data.equipment.filter((e) => e.status === 'breakdown').length;
    const avgOee = data.oee.length > 0 ? data.oee.reduce((sum, o) => sum + Number(o.oee), 0) / data.oee.length : 0;
    return { total, running, idle, maintenance, breakdown, avgOee };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设备管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">设备台账、状态监控、OEE、维保计划</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border/60 bg-background/40 px-3 py-1.5 text-xs hover:border-amber-500/60 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Stat label="设备总数" value={summary.total} tone="default" />
          <Stat label="运行中" value={summary.running} tone="success" />
          <Stat label="待机" value={summary.idle} tone="info" />
          <Stat label="维保中" value={summary.maintenance} tone="warning" />
          <Stat label="故障" value={summary.breakdown} tone="danger" />
          <Stat label="平均 OEE" value={`${summary.avgOee.toFixed(1)}%`} tone={summary.avgOee >= 75 ? 'success' : summary.avgOee >= 60 ? 'warning' : 'danger'} />
        </div>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索设备编号 / 名称 / 型号 / 车间"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="全部" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              {EQUIPMENT_STATUS_OPTIONS.map((s) => (
                <FilterChip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
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
            <Cog className="h-8 w-8 opacity-30" />
            <p className="text-sm">没有符合条件的设备</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => {
            const oee = oeeByEquipment.get(e.code);
            const upcomingMaintenance = maintenanceByEquipment
              .get(e.code)
              ?.find((m) => m.status === 'pending' || m.status === 'in_progress');
            return (
              <Card key={e.id} className="border-border/60 bg-card/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-amber-400">{e.code}</span>
                        <StatusBadge kind="equipment" value={e.status} />
                      </div>
                      <div className="mt-1 truncate text-base font-medium">{e.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {e.manufacturer || '-'} · {e.model || '-'} · {e.workshop || '-'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {e.current_work_order_no && (
                    <div className="border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px]">
                      <span className="text-muted-foreground">当前加工:</span>{' '}
                      <span className="font-mono text-amber-300">{e.current_work_order_no}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label="开动率" value={oee ? `${Number(oee.availability).toFixed(0)}%` : '-'} tone="info" />
                    <Metric label="性能率" value={oee ? `${Number(oee.performance).toFixed(0)}%` : '-'} tone="info" />
                    <Metric label="合格率" value={oee ? `${Number(oee.quality).toFixed(0)}%` : '-'} tone="info" />
                  </div>
                  {oee && (
                    <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                      <span className="text-muted-foreground">OEE</span>
                      <span className={`font-mono text-lg ${Number(oee.oee) >= 75 ? 'text-emerald-400' : Number(oee.oee) >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {Number(oee.oee).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="space-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="h-3 w-3" />
                      <span>上次保养: {formatDate(e.last_maintenance_date)}</span>
                    </div>
                    {e.next_maintenance_date && (
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3 w-3" />
                        <span>下次保养: {formatDate(e.next_maintenance_date)}</span>
                      </div>
                    )}
                    {upcomingMaintenance && (
                      <div className="mt-1 border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px]">
                        <Gauge className="mr-1 inline h-3 w-3" />
                        待执行: {upcomingMaintenance.maintenance_type} · {formatDate(upcomingMaintenance.planned_date)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'default' | 'info' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    default: 'text-foreground',
    info: 'text-sky-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  }[tone];
  return (
    <div className="border border-border/40 bg-card/40 p-3">
      <div className={`font-mono text-xl ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'info' | 'default' }) {
  const toneClass = tone === 'info' ? 'text-sky-300' : 'text-foreground';
  return (
    <div className="border border-border/30 bg-background/30 p-1.5">
      <div className={`font-mono text-sm ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
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
