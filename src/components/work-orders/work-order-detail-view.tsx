"use client";

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Factory,
  PauseCircle,
  PlayCircle,
  History,
  Package,
  AlertCircle,
  Play,
  Send,
  Pencil,
  Trash2,
  X as XIcon,
} from 'lucide-react';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { WO_STATUS_LABELS } from '@/lib/constants';
import type {
  WorkOrder,
  WorkOrderOperation,
  WorkOrderReport,
  OperationReport,
} from '@/types/mes';

type DetailResponse = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
  workOrderReports: WorkOrderReport[];
  operationReports: OperationReport[];
};

// 默认时间（前端 datetime-local 用）
function nowLocalStr(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function localStrToIso(s: string): string {
  if (!s) return new Date().toISOString();
  // datetime-local 字符串视作本地时间
  return new Date(s).toISOString();
}

function isoToLocalStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function WorkOrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 选中查看的工序（下方历史用）
  const [activeOpId, setActiveOpId] = useState<string | null>(null);

  // ====== 工单报工 表单(精简:只录生产批号+开始时间) ======
  const [woForm, setWoForm] = useState({
    batch_no: '',
    start_at: nowLocalStr(),
  });
  const [editingWoReportId, setEditingWoReportId] = useState<string | null>(null);
  const [woDialogOpen, setWoDialogOpen] = useState(false);

  // ====== 工序报工 表单 ======
  const [opForm, setOpForm] = useState<{
    work_order_report_id: string;
    operation_id: string;
    process_name: string;
    sequence: number;
    material_code: string;
    material_name: string;
    material_batch_no: string;
    input_qty: number;
    defect_qty: number;
    notes: string;
  }>({
    work_order_report_id: '',
    operation_id: '',
    process_name: '',
    sequence: 0,
    material_code: '',
    material_name: '',
    material_batch_no: '',
    input_qty: 0,
    defect_qty: 0,
    notes: '',
  });
  const [editingOpReportId, setEditingOpReportId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        const d: DetailResponse = json.data;
        setData(d);
        if (d.operations.length > 0 && !activeOpId) {
          setActiveOpId(d.operations[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, activeOpId]);

  useEffect(() => {
    load();
  }, [load]);

  // ===== 顶部 action =====
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

  // ===== 工单报工 提交 =====
  const handleWoReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woForm.batch_no || !woForm.start_at) {
      alert('生产批号、开始时间为必填');
      return;
    }
    setSubmitting(true);
    try {
      const url = editingWoReportId
        ? `/api/work-orders/${id}/reports/${editingWoReportId}`
        : `/api/work-orders/${id}/reports`;
      const method = editingWoReportId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_no: woForm.batch_no,
          start_at: localStrToIso(woForm.start_at),
        }),
      });
      const json = await res.json();
      if (json.success) {
        resetWoForm();
        setEditingWoReportId(null);
        setWoDialogOpen(false);
        await load();
      } else {
        alert(json.error || '保存失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateWoDialog = () => {
    resetWoForm();
    setEditingWoReportId(null);
    setWoDialogOpen(true);
  };

  const openEditWoDialog = (r: WorkOrderReport) => {
    setWoForm({
      batch_no: r.batch_no,
      start_at: isoToLocalStr(r.start_at),
    });
    setEditingWoReportId(r.id);
    setWoDialogOpen(true);
  };

  const handleDeleteWoReport = async (reportId: string) => {
    if (!confirm('删除该工单报工单将同时删除其下所有工序报工，是否继续？')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}/reports/${reportId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await load();
      } else {
        alert(json.error || '删除失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseWoReport = async (reportId: string) => {
    if (!confirm('关闭该工单报工单？关闭后不能再添加工序报工，需要再开新批次才能继续生产。')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      const json = await res.json();
      if (json.success) {
        await load();
      } else {
        alert(json.error || '关闭失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenWoReport = async (reportId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}/reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      });
      const json = await res.json();
      if (json.success) {
        await load();
      } else {
        alert(json.error || '重开失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetWoForm = () => {
    setWoForm({
      batch_no: '',
      start_at: nowLocalStr(),
    });
  };

  // ===== 工序报工 提交 =====
  const handleOpReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opForm.work_order_report_id) {
      alert('请先在「工单报工」中创建批次');
      return;
    }
    if (!opForm.operation_id) {
      alert('请选择工序');
      return;
    }
    if (opForm.input_qty < 0 || opForm.defect_qty < 0) {
      alert('数量必须为非负数');
      return;
    }
    if (opForm.defect_qty > opForm.input_qty) {
      alert('不良数量不能超过工序投入数量');
      return;
    }
    setSubmitting(true);
    try {
      const url = editingOpReportId
        ? `/api/work-orders/${id}/reports/${opForm.work_order_report_id}/operation-reports/${editingOpReportId}`
        : `/api/work-orders/${id}/reports/${opForm.work_order_report_id}/operation-reports`;
      const method = editingOpReportId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: opForm.operation_id,
          process_name: opForm.process_name,
          sequence: Number(opForm.sequence),
          material_code: opForm.material_code,
          material_name: opForm.material_name,
          material_batch_no: opForm.material_batch_no,
          input_qty: Number(opForm.input_qty),
          defect_qty: Number(opForm.defect_qty),
          notes: opForm.notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        resetOpForm();
        setEditingOpReportId(null);
        await load();
      } else {
        alert(json.error || '保存失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpReport = (r: OperationReport) => {
    setOpForm({
      work_order_report_id: r.work_order_report_id,
      operation_id: r.operation_id ?? '',
      process_name: r.process_name ?? '',
      sequence: r.sequence ?? 0,
      material_code: r.material_code ?? '',
      material_name: r.material_name ?? '',
      material_batch_no: r.material_batch_no ?? '',
      input_qty: r.input_qty,
      defect_qty: r.defect_qty,
      notes: r.notes ?? '',
    });
    setEditingOpReportId(r.id);
    setActiveOpId(r.operation_id || null);
  };

  const handleDeleteOpReport = async (r: OperationReport) => {
    if (!confirm('确认删除该工序报工单？')) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/work-orders/${id}/reports/${r.work_order_report_id}/operation-reports/${r.id}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (json.success) {
        await load();
      } else {
        alert(json.error || '删除失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetOpForm = () => {
    setOpForm({
      work_order_report_id: opForm.work_order_report_id,
      operation_id: activeOpId || '',
      process_name: activeOp?.operation_name || '',
      sequence: activeOp?.sequence || 0,
      material_code: '',
      material_name: '',
      material_batch_no: '',
      input_qty: 0,
      defect_qty: 0,
      notes: '',
    });
  };

  if (loading || !data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { workOrder: wo, operations, workOrderReports, operationReports } = data;
  const activeOp = operations.find((o) => o.id === activeOpId);
  const opReports = operationReports.filter((r) => r.operation_id === activeOpId);
  const qualified = Math.max(0, Number(opForm.input_qty || 0) - Number(opForm.defect_qty || 0));
  const woIsClosed = wo.status === '完工' || wo.status === '超期完工';
  const woIsStarted = wo.status === '生产中' || wo.status === '暂停';

  return (
    <div className="space-y-4 p-4">
      {/* 顶部：标题 + 状态 + 操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-mono text-xl text-foreground">{wo.order_no}</h1>
          <StatusBadge kind="workOrder" value={wo.status} />
        </div>
        <div className="flex items-center gap-2">
          {wo.status === '开立' && (
            <Button size="sm" onClick={() => handleAction('release')} disabled={submitting}>
              <Send className="mr-1 h-3 w-3" /> 下发
            </Button>
          )}
          {wo.status === '下发' && (
            <Button size="sm" onClick={() => handleAction('start')} disabled={submitting}>
              <Play className="mr-1 h-3 w-3" /> 开工
            </Button>
          )}
          {wo.status === '生产中' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleAction('pause')} disabled={submitting}>
                <PauseCircle className="mr-1 h-3 w-3" /> 暂停
              </Button>
              <Button size="sm" onClick={() => handleAction('complete')} disabled={submitting}>
                <CheckCircle2 className="mr-1 h-3 w-3" /> 完工
              </Button>
            </>
          )}
          {wo.status === '暂停' && (
            <Button size="sm" onClick={() => handleAction('resume')} disabled={submitting}>
              <PlayCircle className="mr-1 h-3 w-3" /> 复产
            </Button>
          )}
        </div>
      </div>

      {/* 工单基础信息 */}
      <Card className="border-border/60 bg-card/40">
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Field label="产品" value={wo.product_name} />
          <Field label="规格" value={wo.specification || "-"} mono />
          <Field label="产线" value={wo.line_name || '-'} mono />
          <Field label="计划数量" value={formatNumber(wo.quantity)} mono />
          <Field label="已完成" value={formatNumber(wo.completed_quantity)} mono accent={wo.completed_quantity > wo.quantity ? 'danger' : undefined} />
          <Field label="不良" value={formatNumber(wo.scrap_quantity)} mono accent={(wo.scrap_quantity || 0) > 0 ? 'danger' : undefined} />
          <Field label="计划开始" value={formatDate(wo.planned_start_date)} mono />
          <Field label="计划结束" value={formatDate(wo.planned_end_date)} mono />
        </CardContent>
      </Card>

      {/* 进度条 */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>生产进度</span>
          <span className="font-mono">{wo.completed_quantity} / {wo.quantity}</span>
        </div>
        <ProgressBar value={wo.quantity > 0 ? Math.min(100, (wo.completed_quantity / wo.quantity) * 100) : 0} />
      </div>

      {/* 两级报工面板 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ===== 工单报工 ===== */}
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />工单报工
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({workOrderReports.length} 条批次)
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!woIsStarted ? (
              <div className="flex items-center gap-2 rounded border border-amber-700/40 bg-amber-900/20 p-3 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>工单开工后（生产中 / 暂停）才能做工单报工</span>
              </div>
            ) : (
              <div className="space-y-3">
                {workOrderReports.some((r) => r.status === '活跃') ? (
                  <div className="flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-900/20 p-2 text-xs text-emerald-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>该工单已存在活跃的工单报工单，请先在「工单报工历史」中关闭当前批次后再开新批次</span>
                  </div>
                ) : (
                  <Dialog open={woDialogOpen} onOpenChange={setWoDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={openCreateWoDialog}
                      >
                        <Send className="mr-1 h-3 w-3" />添加工单报工
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-border/60 bg-card sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Send className="h-4 w-4" />添加工单报工
                        </DialogTitle>
                        <DialogDescription>
                          录入生产批号与开工时间,作为该批次的抬头,后续工序报工将以该批次为上下文。
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleWoReportSubmit} className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">
                            生产批号 <span className="text-rose-400">*</span>
                          </label>
                          <Input
                            value={woForm.batch_no}
                            onChange={(e) => setWoForm({ ...woForm, batch_no: e.target.value })}
                            placeholder="如：B20260618-001"
                            required
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            开始时间 <span className="text-rose-400">*</span>
                          </label>
                          <Input
                            type="datetime-local"
                            value={woForm.start_at}
                            onChange={(e) => setWoForm({ ...woForm, start_at: e.target.value })}
                            required
                          />
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setWoDialogOpen(false)}
                            disabled={submitting}
                          >
                            <XIcon className="mr-1 h-3 w-3" />取消
                          </Button>
                          <Button type="submit" disabled={submitting}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {editingWoReportId ? '保存修改' : '确认录入'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}

                {workOrderReports.length > 0 && (
                  <div className="border border-border/40 bg-background/30 p-2 text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">当前活跃批次</div>
                    {(() => {
                      const active = workOrderReports.find((r) => r.status === '活跃') || workOrderReports[0];
                      return (
                        <div className="mt-1 grid grid-cols-2 gap-2 font-mono">
                          <div>
                            <span className="text-muted-foreground">批号 </span>
                            <span className="text-amber-400">{active.batch_no}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">开工 </span>
                            <span className="text-foreground/90">{formatDateTime(active.start_at)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== 工序报工 ===== */}
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Factory className="h-4 w-4" />工序报工
              <span className="text-[10px] font-normal text-muted-foreground">
                (当前工序：{activeOp?.operation_name || '-'} · 合格数量自动 = 投入 - 不良)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {woIsClosed ? (
              <div className="flex items-center gap-2 rounded border border-rose-700/40 bg-rose-900/20 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>工单已完工/超期完工，不允许工序报工</span>
              </div>
            ) : workOrderReports.length === 0 ? (
              <div className="flex items-center gap-2 rounded border border-amber-700/40 bg-amber-900/20 p-3 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>请先在「工单报工」中创建批次（生产批号 + 开始时间）</span>
              </div>
            ) : !activeOp ? (
              <p className="py-4 text-center text-xs text-muted-foreground">请选择工序</p>
            ) : (
              <form onSubmit={handleOpReportSubmit} className="space-y-3">
                {/* 抬头：当前批次信息(从工单报工继承) */}
                {(() => {
                  const currentBatchId = opForm.work_order_report_id || workOrderReports[0]?.id || '';
                  const currentBatch = workOrderReports.find((r) => r.id === currentBatchId);
                  return (
                    <div className="border border-amber-500/30 bg-amber-900/10 p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/80">
                        <ChevronRight className="h-3 w-3" />当前报工批次(抬头)
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-sm">
                        <div>
                          <span className="text-[10px] text-muted-foreground">生产批号</span>
                          <div className="font-mono text-amber-400">{currentBatch?.batch_no || '-'}</div>
                        </div>
                        <div className="h-7 w-px bg-border/40" />
                        <div>
                          <span className="text-[10px] text-muted-foreground">开工时间</span>
                          <div className="font-mono text-foreground/90">{currentBatch ? formatDateTime(currentBatch.start_at) : '-'}</div>
                        </div>
                        <div className="h-7 w-px bg-border/40" />
                        <div>
                          <span className="text-[10px] text-muted-foreground">状态</span>
                          <div className={`font-mono ${currentBatch?.status === '活跃' ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {currentBatch?.status || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="border border-border/40 bg-background/30 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground">
                      {editingOpReportId ? '正在修改工序报工' : '新增工序报工'}
                    </div>
                    {editingOpReportId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOpReportId(null);
                          resetOpForm();
                        }}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        取消修改
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-sm text-amber-400">
                    {activeOp.sequence}. {activeOp.operation_name}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">
                    切换报工批次 <span className="text-rose-400">*</span>
                  </label>
                  <select
                    className="flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={opForm.work_order_report_id || (editingOpReportId ? '' : workOrderReports[0]?.id || '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOpForm({ ...opForm, work_order_report_id: v });
                    }}
                    required
                  >
                    {workOrderReports.map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={r.status === '已关闭' && r.id !== opForm.work_order_report_id}
                      >
                        {r.batch_no}（{formatDateTime(r.start_at)}）— {r.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">物料编码 / 物料名称 / 批次号</label>
                  <div className="grid grid-cols-3 gap-1">
                    <Input
                      value={opForm.material_code}
                      onChange={(e) => setOpForm({ ...opForm, material_code: e.target.value })}
                      placeholder="物料编码"
                    />
                    <Input
                      value={opForm.material_name}
                      onChange={(e) => setOpForm({ ...opForm, material_name: e.target.value })}
                      placeholder="物料名称"
                    />
                    <Input
                      value={opForm.material_batch_no}
                      onChange={(e) => setOpForm({ ...opForm, material_batch_no: e.target.value })}
                      placeholder="物料批次"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      工序投入数量 <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={opForm.input_qty}
                      onChange={(e) => setOpForm({ ...opForm, input_qty: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">不良数量</label>
                    <Input
                      type="number"
                      min="0"
                      value={opForm.defect_qty}
                      onChange={(e) => setOpForm({ ...opForm, defect_qty: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">合格数量 (自动)</label>
                    <div className="flex h-9 items-center border border-border/40 bg-muted/30 px-3 font-mono text-sm text-emerald-400">
                      {formatNumber(qualified)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">备注</label>
                  <Input
                    value={opForm.notes}
                    onChange={(e) => setOpForm({ ...opForm, notes: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {editingOpReportId ? '保存修改' : '添加工序报工'}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  工序合格数量 = 工序投入 - 不良数量（自动计算）
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 工序路线 */}
      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />连续工序路线 ({operations.length} 道) — 点击切换工序
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
                    <span className="font-mono text-[10px] text-muted-foreground">{op.sequence}/8</span>
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

      {/* 工单报工历史 */}
      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />工单报工历史 ({workOrderReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrderReports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无工单报工记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">生产批号</th>
                    <th className="pb-2 pr-3">状态</th>
                    <th className="pb-2 pr-3">开始时间</th>
                    <th className="pb-2 pr-3">换线时间</th>
                    <th className="pb-2 pr-3 text-right">技工</th>
                    <th className="pb-2 pr-3 text-right">普工</th>
                    <th className="pb-2 pr-3 text-right">劳务工</th>
                    <th className="pb-2 pr-3 text-right">清场(分钟)</th>
                    <th className="pb-2">备注</th>
                    <th className="pb-2 pr-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrderReports.map((r) => {
                    const editable = !woIsClosed;
                    const isEditing = r.id === editingWoReportId;
                    const isActive = r.status === '活跃';
                    const opCount = operationReports.filter((or) => or.work_order_report_id === r.id).length;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-border/20 ${
                          isEditing ? 'bg-amber-900/20' : isActive ? 'bg-emerald-900/10' : ''
                        }`}
                      >
                        <td className="py-2 pr-3 font-mono text-amber-400">
                          {r.batch_no}
                          <span className="ml-1 text-[10px] text-muted-foreground">({opCount} 道工序)</span>
                        </td>
                        <td className="py-2 pr-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                              活跃
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-slate-500/40 bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                              已关闭
                              {r.closed_at && (
                                <span className="ml-1 font-mono text-slate-500">{formatDateTime(r.closed_at).slice(5, 16)}</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{formatDateTime(r.start_at)}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                          {r.change_line_at ? formatDateTime(r.change_line_at) : '-'}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{r.skilled_workers}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.general_workers}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.labor_workers}</td>
                        <td className="py-2 pr-3 text-right font-mono">{r.cleanup_minutes}</td>
                        <td className="py-2 text-xs text-muted-foreground">{r.notes || '-'}</td>
                        <td className="py-2 pr-3 text-right">
                          {editable && (
                            <div className="flex justify-end gap-1">
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleCloseWoReport(r.id)}
                                  className="rounded border border-slate-500/40 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                                  title="关闭批次"
                                >
                                  关闭
                                </button>
                              )}
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleReopenWoReport(r.id)}
                                  className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-900/20"
                                  title="重新打开批次"
                                >
                                  重开
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditWoDialog(r)}
                                className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-400 hover:bg-amber-900/20"
                                title="修改"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWoReport(r.id)}
                                className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-900/20"
                                title="删除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 工序报工历史 */}
      <Card className="border-border/60 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            工序报工历史 — {activeOp?.operation_name || '-'} ({opReports.length})
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
                    <th className="pb-2 pr-3">物料</th>
                    <th className="pb-2 pr-3">物料批次</th>
                    <th className="pb-2 pr-3 text-right">投入</th>
                    <th className="pb-2 pr-3 text-right">不良</th>
                    <th className="pb-2 pr-3 text-right">合格(自动)</th>
                    <th className="pb-2">备注</th>
                    <th className="pb-2 pr-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {opReports.map((r) => {
                    const editable = !woIsClosed;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/20 hover:bg-amber-900/5"
                      >
                        <td className="py-2 pr-3">
                          <div className="text-xs">
                            {r.material_code && <span className="font-mono">{r.material_code}</span>}
                            {r.material_code && r.material_name && <span className="mx-1 text-muted-foreground">·</span>}
                            {r.material_name}
                          </div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                          {r.material_batch_no || '-'}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.input_qty)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-rose-400">{formatNumber(r.defect_qty)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-emerald-400">{formatNumber(r.qualified_qty)}</td>
                        <td className="py-2 text-xs text-muted-foreground">{r.notes || '-'}</td>
                        <td className="py-2 pr-3 text-right">
                          {editable && (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditOpReport(r)}
                                className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-400 hover:bg-amber-900/20"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOpReport(r)}
                                className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-400 hover:bg-rose-900/20"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm ${
          mono ? 'font-mono tabular-nums' : ''
        } ${accent === 'danger' ? 'text-rose-400' : 'text-foreground/90'}`}
      >
        {value}
      </div>
    </div>
  );
}
