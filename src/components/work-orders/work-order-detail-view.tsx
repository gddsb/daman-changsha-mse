"use client";

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import { ArrowLeft, CheckCircle2, ChevronRight, Factory, PauseCircle, PlayCircle, History, Package, AlertCircle, Send, ScanLine } from 'lucide-react';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { WO_STATUS_LABELS, PROCESS_STATUS_LABELS, SHIFT_TONE, INSPECTION_TYPE_LABELS } from '@/lib/constants';
import type { WorkOrder, WorkOrderOperation, WorkOrderReport, InspectionType } from '@/types/mes';

type DetailResponse = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
  reports: WorkOrderReport[];
};

const SHIFTS = ['白班', '夜班'] as const;
const INSPECTION_TYPES: InspectionType[] = ['first', 'in_process', 'final', 'outgoing'];

export function WorkOrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const [form, setForm] = useState({
    good_qty: '',
    scrap_qty: '',
    operator: '',
    shift_no: '白班' as '白班' | '夜班',
    can_spec: '',
    can_height: '',
    batch_no: '',
    inspector_name: '',
    inspection_type: 'in_process' as InspectionType,
    scrap_reason: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.operations.length > 0 && !activeOpId) {
          setActiveOpId(json.data.operations[0].id);
          setForm((f) => ({
            ...f,
            can_spec: json.data.workOrder.specification || '',
            batch_no: json.data.workOrder.batch_no || '',
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, activeOpId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (action: 'release' | 'start' | 'pause' | 'resume' | 'complete') => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await load();
      } else {
        alert(json.error || '操作失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOpId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: activeOpId,
          ...form,
          good_qty: Number(form.good_qty) || 0,
          scrap_qty: Number(form.scrap_qty) || 0,
          can_height: form.can_height ? Number(form.can_height) : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setForm({ ...form, good_qty: '', scrap_qty: '', scrap_reason: '' });
        await load();
      } else {
        alert(json.error || '报工失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-muted-foreground">工单不存在</div>;

  const { workOrder: wo, operations, reports } = data;
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  const yieldRate = wo.completed_quantity + wo.scrap_quantity > 0
    ? (wo.completed_quantity / (wo.completed_quantity + wo.scrap_quantity)) * 100
    : 100;
  const activeOp = operations.find((o) => o.id === activeOpId);
  const opReports = activeOp ? reports.filter((r) => r.operation_id === activeOp.id) : [];
  const totalGood = operations.reduce((s, o) => s + (o.good_quantity || 0), 0);
  const totalScrap = operations.reduce((s, o) => s + (o.scrap_quantity || 0), 0);
  const completedOps = operations.filter((o) => o.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/work-orders')}>
          <ArrowLeft className="mr-1 h-3 w-3" />返回工单列表
        </Button>
        <ChevronRight className="h-3 w-3" />
        <span>工单详情</span>
      </div>

      <div className="border border-border/60 bg-card/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-bold text-amber-400">{wo.order_no}</h1>
              <StatusBadge kind="workOrder" value={wo.status} />
              <span className="border border-border/40 bg-background/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {wo.line_name || '未分配产线'}
              </span>
              {wo.order_type && (
                <span className="border border-border/40 bg-background/30 px-2 py-0.5 text-xs text-muted-foreground">
                  {wo.order_type}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/80">{wo.product_name} · <span className="font-mono text-xs text-muted-foreground">{wo.product_code}</span></p>
            {wo.specification && (
              <p className="mt-0.5 text-xs text-muted-foreground">规格: {wo.specification}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {wo.status === 'planned' && (
              <Button size="sm" onClick={() => handleAction('release')} disabled={submitting}>
                <PlayCircle className="mr-2 h-4 w-4" />下发工单
              </Button>
            )}
            {wo.status === 'released' && (
              <Button size="sm" onClick={() => handleAction('start')} disabled={submitting}>
                <Factory className="mr-2 h-4 w-4" />开始生产
              </Button>
            )}
            {wo.status === 'in_progress' && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleAction('pause')} disabled={submitting}>
                  <PauseCircle className="mr-2 h-4 w-4" />暂停
                </Button>
                <Button size="sm" onClick={() => handleAction('complete')} disabled={submitting}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />完工
                </Button>
              </>
            )}
            {wo.status === 'paused' && (
              <Button size="sm" onClick={() => handleAction('resume')} disabled={submitting}>
                <PlayCircle className="mr-2 h-4 w-4" />恢复
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">生产进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-mono text-4xl text-foreground">
                    {formatNumber(wo.completed_quantity)}<span className="text-base text-muted-foreground">/{formatNumber(wo.quantity)} {wo.unit || '罐'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">已完工 / 计划数量</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl text-emerald-400">{yieldRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">一次合格率</div>
                </div>
              </div>
              <ProgressBar value={rate} className="mt-3" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 sm:grid-cols-4">
              <Field label="计划开始" value={formatDate(wo.planned_start_date)} />
              <Field label="计划结束" value={formatDate(wo.planned_end_date)} />
              <Field label="实际开始" value={formatDate(wo.actual_start_date)} />
              <Field label="不良数量" value={formatNumber(wo.scrap_quantity)} accent="danger" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 sm:grid-cols-4">
              <Field label="车间" value={wo.workshop || '-'} />
              <Field label="产线" value={wo.line_name || '-'} />
              <Field label="已完工序" value={`${completedOps} / ${operations.length} 道`} />
              <Field label="优先级" value={`P${wo.priority}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 sm:grid-cols-4">
              <Field label="累计良品" value={formatNumber(totalGood)} mono />
              <Field label="累计不良" value={formatNumber(totalScrap)} accent="danger" mono />
              <Field label="单位" value={wo.unit || '罐'} />
              <Field label="工单状态" value={WO_STATUS_LABELS[wo.status] || wo.status} />
            </div>
            {wo.notes && (
              <div className="border-t border-border/40 pt-3 text-sm text-muted-foreground">
                备注: <span className="text-foreground/80">{wo.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />工序报工
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wo.status !== 'in_progress' ? (
              <div className="flex items-center gap-2 rounded border border-amber-700/40 bg-amber-900/20 p-3 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>工单开始生产后才能报工</span>
              </div>
            ) : !activeOp ? (
              <p className="py-4 text-center text-xs text-muted-foreground">请选择工序</p>
            ) : (
              <form onSubmit={handleReport} className="space-y-3">
                <div className="border border-border/40 bg-background/30 p-2 text-xs">
                  <div className="text-muted-foreground">当前工序</div>
                  <div className="mt-0.5 font-mono text-sm text-amber-400">
                    {activeOp.sequence}. {activeOp.operation_name}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">良品数</label>
                    <Input type="number" min="0" value={form.good_qty} onChange={(e) => setForm({ ...form, good_qty: e.target.value })} placeholder="0" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">不良数</label>
                    <Input type="number" min="0" value={form.scrap_qty} onChange={(e) => setForm({ ...form, scrap_qty: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">操作员</label>
                    <Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="姓名" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">班次</label>
                    <select
                      className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={form.shift_no}
                      onChange={(e) => setForm({ ...form, shift_no: e.target.value as '白班' | '夜班' })}
                    >
                      {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">检验类型</label>
                    <select
                      className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={form.inspection_type}
                      onChange={(e) => setForm({ ...form, inspection_type: e.target.value as InspectionType })}
                    >
                      {INSPECTION_TYPES.map((t) => <option key={t} value={t}>{INSPECTION_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">检验员</label>
                    <Input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} placeholder="姓名" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">罐型规格</label>
                    <Input value={form.can_spec} onChange={(e) => setForm({ ...form, can_spec: e.target.value })} placeholder="如:502#" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">罐高(mm)</label>
                    <Input type="number" value={form.can_height} onChange={(e) => setForm({ ...form, can_height: e.target.value })} placeholder="如:165" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">批次号</label>
                  <Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} placeholder="如:20260617-A(3)" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">不良原因(选填)</label>
                  <Input value={form.scrap_reason} onChange={(e) => setForm({ ...form, scrap_reason: e.target.value })} placeholder="如:印铁划伤" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  <Send className="mr-2 h-4 w-4" />提交报工（同时生成质量日报）
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />连续工序路线 ({operations.length} 道) — 点击切换报工
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {operations.map((op) => {
              const isActive = op.id === activeOpId;
              return (
                <button
                  key={op.id}
                  onClick={() => setActiveOpId(op.id)}
                  className={`group relative border p-2 text-left transition-colors ${
                    isActive
                      ? 'border-amber-500/60 bg-amber-900/20'
                      : 'border-border/40 bg-background/30 hover:border-border/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">{op.sequence}/13</span>
                    <span className="font-mono text-[10px] text-fg-2">{op.sequence}</span>
                  </div>
                  <div className="mt-1 truncate text-xs font-medium text-foreground/90">{op.operation_name}</div>
                  <div className="mt-1 flex items-baseline justify-between font-mono text-[10px]">
                    <span className="text-emerald-400">{op.good_quantity || 0}</span>
                    <span className="text-rose-400">-{op.scrap_quantity || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            报工历史 — {activeOp?.operation_name || '-'} ({opReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opReports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">该工序暂无报工记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">报工时间</th>
                    <th className="pb-2 pr-3">操作员</th>
                    <th className="pb-2 pr-3">班次</th>
                    <th className="pb-2 pr-3">检验类型</th>
                    <th className="pb-2 pr-3 text-right">良品</th>
                    <th className="pb-2 pr-3 text-right">不良</th>
                    <th className="pb-2 pr-3">批次</th>
                    <th className="pb-2">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {opReports.map((r) => (
                    <tr key={r.id} className="border-b border-border/20">
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{formatDateTime(r.reported_at)}</td>
                      <td className="py-2 pr-3">{r.operator_name || '-'}</td>
                      <td className="py-2 pr-3">
                        <span className={`border px-1.5 py-0.5 text-[10px] ${SHIFT_TONE[r.shift_no || '白班'] || SHIFT_TONE['白班']}`}>
                          {r.shift_no || '白班'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{(r as { inspection_type?: string }).inspection_type || '-'}</td>
                      <td className="py-2 pr-3 text-right font-mono text-emerald-400">{formatNumber(r.good_quantity)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-rose-400">{formatNumber(r.scrap_quantity)}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{r.batch_no || '-'}</td>
                      <td className="py-2 text-xs text-muted-foreground">{r.scrap_reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: 'danger' }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${mono ? 'font-mono' : ''} ${accent === 'danger' ? 'text-rose-400' : 'text-foreground/80'}`}>{value}</div>
    </div>
  );
}
