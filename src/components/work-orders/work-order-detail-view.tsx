"use client";

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import { ArrowLeft, CheckCircle2, Factory, PauseCircle, PlayCircle, ClipboardList, History, Package } from 'lucide-react';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { WorkOrder, WorkOrderOperation, WorkOrderReport } from '@/types/mes';

type DetailResponse = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
  reports: WorkOrderReport[];
};

export function WorkOrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({ good_qty: '', scrap_qty: '', operator: '', scrap_reason: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      if (json.success) await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const good = Number(reportForm.good_qty || 0);
    const scrap = Number(reportForm.scrap_qty || 0);
    if (!reportForm.operator) {
      alert('请填写报工人员');
      return;
    }
    if (good + scrap <= 0) {
      alert('请填写至少一件良品或不良品');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_name: reportForm.operator,
          good_quantity: good,
          scrap_quantity: scrap,
          scrap_reason: reportForm.scrap_reason || null,
          report_type: 'production',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReportForm({ good_qty: '', scrap_qty: '', operator: reportForm.operator, scrap_reason: '' });
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
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        工单不存在
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push('/work-orders')}>返回列表</Button>
        </div>
      </div>
    );
  }

  const { workOrder: wo, operations, reports } = data;
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  const yieldRate = wo.completed_quantity + wo.scrap_quantity > 0
    ? (wo.completed_quantity / (wo.completed_quantity + wo.scrap_quantity)) * 100
    : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/work-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-amber-400">{wo.order_no}</h1>
            <StatusBadge kind="workOrder" value={wo.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{wo.product_name} · <span className="font-mono">{wo.product_code}</span></p>
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
              <PlayCircle className="mr-2 h-4 w-4" />恢复生产
            </Button>
          )}
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
                  <div className="font-mono text-4xl text-foreground">{formatNumber(wo.completed_quantity)}<span className="text-base text-muted-foreground">/{formatNumber(wo.quantity)}</span></div>
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
              <Field label="设备" value={operations[0]?.equipment_name || operations[0]?.equipment_code || '-'} />
              <Field label="来源销售订单" value={wo.sales_order_no || '-'} mono />
              <Field label="优先级" value={`P${wo.priority}`} />
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
              <ClipboardList className="h-4 w-4" />快速报工
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReport} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">报工人员</label>
                <Input value={reportForm.operator} onChange={(e) => setReportForm({ ...reportForm, operator: e.target.value })} placeholder="姓名 / 工号" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">良品数</label>
                  <Input type="number" min="0" value={reportForm.good_qty} onChange={(e) => setReportForm({ ...reportForm, good_qty: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">不良数</label>
                  <Input type="number" min="0" value={reportForm.scrap_qty} onChange={(e) => setReportForm({ ...reportForm, scrap_qty: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">不良原因(选填)</label>
                <Input value={reportForm.scrap_reason} onChange={(e) => setReportForm({ ...reportForm, scrap_reason: e.target.value })} placeholder="如:尺寸超差" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || wo.status !== 'in_progress'}>
                提交报工
              </Button>
              {wo.status !== 'in_progress' && (
                <p className="text-[11px] text-muted-foreground">工单开始生产后才能报工</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />工序路线 ({operations.length} 道)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">未配置工序</p>
          ) : (
            <div className="space-y-2">
              {operations.map((op, idx) => (
                <div key={op.id} className="flex items-center gap-3 border border-border/30 bg-background/30 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-amber-500/40 font-mono text-sm text-amber-400">
                    {op.sequence}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{op.operation_name}</span>
                      <StatusBadge kind="operation" value={op.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      工作中心: {op.equipment_name || op.equipment_code || '-'} · 标准工时: {op.standard_time_minutes || 0} 分钟 · 操作员: {op.operator_name || '-'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>良品 <span className="font-mono text-foreground">{op.good_quantity || 0}</span></div>
                    <div>不良 <span className="font-mono text-rose-400">{op.scrap_quantity || 0}</span></div>
                  </div>
                  {idx < operations.length - 1 && (
                    <div className="absolute hidden" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />报工历史 ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无报工记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">报工时间</th>
                    <th className="pb-2 pr-4">操作员</th>
                    <th className="pb-2 pr-4">类型</th>
                    <th className="pb-2 pr-4 text-right">良品</th>
                    <th className="pb-2 pr-4 text-right">不良</th>
                    <th className="pb-2">不良原因</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-border/20">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{formatDateTime(r.reported_at)}</td>
                      <td className="py-2 pr-4">{r.operator_name}</td>
                      <td className="py-2 pr-4"><StatusBadge kind="reportType" value={r.report_type} /></td>
                      <td className="py-2 pr-4 text-right font-mono text-emerald-400">{r.good_quantity}</td>
                      <td className="py-2 pr-4 text-right font-mono text-rose-400">{r.scrap_quantity}</td>
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
