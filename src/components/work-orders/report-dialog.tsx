"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronLeft, ChevronRight, Save, Play, X, Plus, Trash2 } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";
import type {
  WorkOrder,
  WorkOrderOperation,
  WorkOrderReport,
  OperationReport,
  OperationDefect,
  EquipmentDowntime,
  ProcessInfo,
} from "@/types/mes";

type Step = 1 | 2 | 3;

type OpDraft = {
  operation_seq: number;
  operation_name: string;
  input_quantity: number;
  pass_quantity: number;
  fail_quantity: number;
  incoming_defect_piece: number;
  incoming_defect_cover: number;
  process_defect_piece: number;
  process_defect_cover: number;
  saved: boolean;
  opReportId?: string;
};

type DefectDraft = {
  id?: string;
  defect_category: "制程不良" | "来料不良";
  defect_name: string;
  defect_quantity: number;
  unit: "小片" | "带盖" | "";
};

type DowntimeDraft = {
  id?: string;
  anomaly_type: "设备故障" | "来料不良" | "其它原因";
  equipment_code: string;
  problem_description: string;
  start_time: string;
  end_time: string;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
  editingReport: WorkOrderReport | null;
  onSuccess: () => void;
}

export function ReportDialog({ open, onOpenChange, workOrder, operations, editingReport, onSuccess }: Props) {
  const isCreate = !editingReport;
  const [step, setStep] = useState<Step>(1);
  const [report, setReport] = useState<WorkOrderReport | null>(editingReport);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: 工单报工表单
  const [batchNo, setBatchNo] = useState("");
  const [startTime, setStartTime] = useState("");
  const [skilled, setSkilled] = useState(0);
  const [regular, setRegular] = useState(0);
  const [contract, setContract] = useState(0);
  const [other, setOther] = useState(0);

  // Step 2: 工序报工
  const [opDrafts, setOpDrafts] = useState<OpDraft[]>([]);
  const [defects, setDefects] = useState<DefectDraft[]>([]);
  const [downtimes, setDowntimes] = useState<DowntimeDraft[]>([]);
  const [defectDraft, setDefectDraft] = useState<DefectDraft>({
    defect_category: "制程不良",
    defect_name: "",
    defect_quantity: 0,
    unit: "小片",
  });
  const [dtDraft, setDtDraft] = useState<DowntimeDraft>({
    anomaly_type: "设备故障",
    equipment_code: "",
    problem_description: "",
    start_time: "",
    end_time: "",
  });

  // 加载已有数据（编辑模式）
  useEffect(() => {
    if (!open) return;
    if (editingReport) {
      setReport(editingReport);
      setBatchNo(editingReport.batch_no);
      setStartTime(toLocalInputTime(editingReport.start_time));
      setSkilled(editingReport.skilled_worker_count);
      setRegular(editingReport.regular_worker_count);
      setContract(editingReport.contract_worker_count);
      setOther(editingReport.other_worker_count);
      // 加载工序/不良/异常
      loadReportChildren(editingReport.id);
    } else {
      // 新建模式：重置
      setReport(null);
      setBatchNo("");
      setStartTime(toLocalInputTime(new Date().toISOString()));
      setSkilled(0);
      setRegular(0);
      setContract(0);
      setOther(0);
      setOpDrafts(operations.map((op) => initOpDraft(op)));
      setDefects([]);
      setDowntimes([]);
    }
    setStep(1);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingReport?.id]);

  const loadReportChildren = async (reportId: string) => {
    try {
      const r = await fetch(`/api/reports/${reportId}`, { cache: "no-store" });
      const j = await r.json();
      if (!j?.success) return;
      const d = j.data;
      // 工序
      const opMap = new Map((d.operations as OperationReport[]).map((o) => [o.operation_seq, o]));
      setOpDrafts(
        operations.map((op) => {
          const saved = opMap.get(op.sequence);
          if (saved) {
            return {
              operation_seq: op.sequence,
              operation_name: op.operation_name || op.operation_code || "",
              input_quantity: saved.input_quantity,
              pass_quantity: saved.pass_quantity,
              fail_quantity: saved.fail_quantity,
              incoming_defect_piece: saved.incoming_defect_piece,
              incoming_defect_cover: saved.incoming_defect_cover,
              process_defect_piece: saved.process_defect_piece,
              process_defect_cover: saved.process_defect_cover,
              saved: true,
              opReportId: saved.id,
            };
          }
          return initOpDraft(op);
        })
      );
      setDefects(
        (d.defects as OperationDefect[]).map((x) => ({
          id: x.id,
          defect_category: x.defect_category,
          defect_name: x.defect_name,
          defect_quantity: x.defect_quantity,
          unit: x.unit || "",
        }))
      );
      setDowntimes(
        (d.downtimes as EquipmentDowntime[]).map((x) => ({
          id: x.id,
          anomaly_type: x.anomaly_type,
          equipment_code: x.equipment_code,
          problem_description: x.problem_description,
          start_time: toLocalInputTime(x.start_time),
          end_time: toLocalInputTime(x.end_time),
        }))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // 步骤 1：创建/更新工单报工
  const handleSubmitStep1 = async () => {
    setError(null);
    if (!batchNo.trim()) {
      setError("请输入生产批号");
      return;
    }
    if (!startTime) {
      setError("请选择开工时间");
      return;
    }
    setSubmitting(true);
    try {
      if (isCreate) {
        const r = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_order_id: workOrder.id,
            batch_no: batchNo.trim(),
            start_time: new Date(startTime).toISOString(),
            skilled_worker_count: skilled,
            regular_worker_count: regular,
            contract_worker_count: contract,
            other_worker_count: other,
          }),
        });
        const j = await r.json();
        if (!j?.success) throw new Error(j?.error || "创建报工失败");
        setReport(j.data);
        setStep(2);
      } else {
        // 编辑模式：更新主表（暂不支持修改主表字段，只前进到步骤 2）
        setStep(2);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 步骤 2：保存单条工序报工
  const saveOpReport = async (idx: number) => {
    if (!report) return;
    const d = opDrafts[idx];
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/reports/${report.id}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_order_report_id: report.id,
          operation_seq: d.operation_seq,
          operation_name: d.operation_name,
          input_quantity: d.input_quantity,
          pass_quantity: d.pass_quantity,
          fail_quantity: d.fail_quantity,
          incoming_defect_piece: d.incoming_defect_piece,
          incoming_defect_cover: d.incoming_defect_cover,
          process_defect_piece: d.process_defect_piece,
          process_defect_cover: d.process_defect_cover,
        }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "保存工序报工失败");
      const saved = j.data as OperationReport;
      const next = [...opDrafts];
      next[idx] = { ...d, saved: true, opReportId: saved.id };
      setOpDrafts(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 步骤 2：添加不良
  const addDefect = async () => {
    if (!report) return;
    if (!defectDraft.defect_name.trim() || defectDraft.defect_quantity <= 0) {
      setError("请填写不良名称和数量");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/reports/${report.id}/defects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_order_report_id: report.id,
          defect_category: defectDraft.defect_category,
          defect_name: defectDraft.defect_name.trim(),
          defect_quantity: defectDraft.defect_quantity,
          unit: defectDraft.unit || null,
        }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "新增不良失败");
      const saved = j.data as OperationDefect;
      setDefects([...defects, { ...defectDraft, id: saved.id }]);
      setDefectDraft({ defect_category: "制程不良", defect_name: "", defect_quantity: 0, unit: "小片" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeDefect = async (id: string) => {
    if (!report) return;
    setSubmitting(true);
    try {
      await fetch(`/api/reports/${report.id}/defects?id=${id}`, { method: "DELETE" });
      setDefects(defects.filter((d) => d.id !== id));
    } finally {
      setSubmitting(false);
    }
  };

  // 步骤 2：添加异常工时
  const addDowntime = async () => {
    if (!report) return;
    if (!dtDraft.start_time || !dtDraft.end_time) {
      setError("请填写停线开始时间和生产恢复时间");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/reports/${report.id}/downtimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_order_report_id: report.id,
          anomaly_type: dtDraft.anomaly_type,
          equipment_code: dtDraft.equipment_code,
          problem_description: dtDraft.problem_description,
          start_time: new Date(dtDraft.start_time).toISOString(),
          end_time: new Date(dtDraft.end_time).toISOString(),
          confirmer: "当前用户",
        }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "新增异常工时失败");
      const saved = j.data as EquipmentDowntime;
      setDowntimes([
        ...downtimes,
        { ...dtDraft, id: saved.id },
      ]);
      setDtDraft({ anomaly_type: "设备故障", equipment_code: "", problem_description: "", start_time: "", end_time: "" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeDowntime = async (id: string) => {
    if (!report) return;
    setSubmitting(true);
    try {
      await fetch(`/api/reports/${report.id}/downtimes?id=${id}`, { method: "DELETE" });
      setDowntimes(downtimes.filter((d) => d.id !== id));
    } finally {
      setSubmitting(false);
    }
  };

  // 步骤 3：关闭批次（自动/手工）
  const closeReport = async (manual: boolean) => {
    if (!report) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/reports/${report.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "关闭报工失败");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 聚合统计
  const totalInput = opDrafts.reduce((s, o) => s + (o.input_quantity || 0), 0);
  const totalPass = opDrafts.reduce((s, o) => s + (o.pass_quantity || 0), 0);
  const totalFail = opDrafts.reduce((s, o) => s + (o.fail_quantity || 0), 0);
  const totalDefectFromDefects = defects.reduce((s, d) => s + (d.defect_quantity || 0), 0);
  const consistencyOk = totalInput === 0 || totalInput - totalFail === totalPass;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-bg-1 border-line">
        <DialogHeader>
          <DialogTitle className="text-fg-0 font-mono">
            报工 — {workOrder.order_no}
          </DialogTitle>
          <DialogDescription>
            <span className="text-fg-2">
              {workOrder.product_name} · 计划数量 {formatNumber(workOrder.quantity)} ·{" "}
              {isCreate ? "开始新批次" : `批次 #${editingReport?.completion_seq}（${editingReport?.batch_no}）`}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 mt-2 text-xs">
          <StepDot n={1} active={step === 1} done={!!report}>工单报工</StepDot>
          <span className="text-fg-3">—</span>
          <StepDot n={2} active={step === 2} done={step > 2}>工序报工 / 不良 / 异常</StepDot>
          <span className="text-fg-3">—</span>
          <StepDot n={3} active={step === 3} done={false}>工单结束</StepDot>
        </div>

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* Step 1: 工单报工 */}
        {step === 1 && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <LabeledInput
                label="生产批号 *"
                value={batchNo}
                onChange={setBatchNo}
                disabled={!isCreate}
                placeholder="不允许输入汉字、通配符、特殊字符"
              />
              <LabeledInput
                label="开工时间 *（5分钟一档）"
                type="datetime-local"
                value={startTime}
                onChange={setStartTime}
                disabled={!isCreate}
                step={300}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LabeledInput label="技工人数" type="number" value={String(skilled)} onChange={(v) => setSkilled(Number(v || 0))} disabled={!isCreate} />
              <LabeledInput label="普工人数" type="number" value={String(regular)} onChange={(v) => setRegular(Number(v || 0))} disabled={!isCreate} />
              <LabeledInput label="劳务人工" type="number" value={String(contract)} onChange={(v) => setContract(Number(v || 0))} disabled={!isCreate} />
              <LabeledInput label="其它人工" type="number" value={String(other)} onChange={(v) => setOther(Number(v || 0))} disabled={!isCreate} />
            </div>
          </div>
        )}

        {/* Step 2: 工序报工 + 不良 + 异常 */}
        {step === 2 && (
          <div className="space-y-4 mt-2">
            <div>
              <div className="text-sm text-fg-1 mb-2 font-mono">工序报工（{opDrafts.length} 道）</div>
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-bg-2 text-fg-2">
                    <tr>
                      <th className="px-2 py-1.5 text-left">工序号</th>
                      <th className="px-2 py-1.5 text-left">工序名称</th>
                      <th className="px-2 py-1.5 text-right">投入数</th>
                      <th className="px-2 py-1.5 text-right">合格数</th>
                      <th className="px-2 py-1.5 text-right">不良数</th>
                      <th className="px-2 py-1.5 text-right">来料不良·小片</th>
                      <th className="px-2 py-1.5 text-right">来料不良·带盖</th>
                      <th className="px-2 py-1.5 text-right">制程不良·小片</th>
                      <th className="px-2 py-1.5 text-right">制程不良·带盖</th>
                      <th className="px-2 py-1.5 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opDrafts.map((op, i) => (
                      <tr key={op.operation_seq} className="border-t border-line">
                        <td className="px-2 py-1.5 font-mono text-fg-1">{op.operation_seq}</td>
                        <td className="px-2 py-1.5 text-fg-0">{op.operation_name}</td>
                        <td className="px-1 py-1"><NumInput value={op.input_quantity} onChange={(v) => updateOp(i, "input_quantity", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.pass_quantity} onChange={(v) => updateOp(i, "pass_quantity", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.fail_quantity} onChange={(v) => updateOp(i, "fail_quantity", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.incoming_defect_piece} onChange={(v) => updateOp(i, "incoming_defect_piece", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.incoming_defect_cover} onChange={(v) => updateOp(i, "incoming_defect_cover", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.process_defect_piece} onChange={(v) => updateOp(i, "process_defect_piece", v)} /></td>
                        <td className="px-1 py-1"><NumInput value={op.process_defect_cover} onChange={(v) => updateOp(i, "process_defect_cover", v)} /></td>
                        <td className="px-1 py-1 text-center">
                          <Button size="sm" variant="outline" onClick={() => saveOpReport(i)} disabled={submitting} className="h-6 text-xs">
                            {op.saved ? "已存" : "保存"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-fg-2 font-mono">
                <span>合计：投入 {formatNumber(totalInput)} / 合格 {formatNumber(totalPass)} / 不良 {formatNumber(totalFail)}</span>
                <span className={consistencyOk ? "text-emerald-500" : "text-rose-500"}>
                  {consistencyOk ? "✓ 一致" : "✗ 投入 - 不良 ≠ 合格"}
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-fg-1 mb-2 font-mono">工序不良（{defects.length} 条 / 累计 {formatNumber(totalDefectFromDefects)}）</div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2 text-xs">
                <select
                  value={defectDraft.defect_category}
                  onChange={(e) => setDefectDraft({ ...defectDraft, defect_category: e.target.value as DefectDraft["defect_category"] })}
                  className="bg-bg-2 border border-line rounded px-2 py-1 text-fg-0"
                >
                  <option value="制程不良">制程不良</option>
                  <option value="来料不良">来料不良</option>
                </select>
                <Input placeholder="不良名称" value={defectDraft.defect_name} onChange={(e) => setDefectDraft({ ...defectDraft, defect_name: e.target.value })} className="h-7" />
                <Input type="number" placeholder="数量" value={String(defectDraft.defect_quantity || "")} onChange={(e) => setDefectDraft({ ...defectDraft, defect_quantity: Number(e.target.value) })} className="h-7" />
                <select
                  value={defectDraft.unit}
                  onChange={(e) => setDefectDraft({ ...defectDraft, unit: e.target.value as DefectDraft["unit"] })}
                  className="bg-bg-2 border border-line rounded px-2 py-1 text-fg-0"
                >
                  <option value="小片">小片</option>
                  <option value="带盖">带盖</option>
                </select>
                <Button size="sm" onClick={addDefect} disabled={submitting} className="h-7">
                  <Plus className="h-3 w-3 mr-1" />新增
                </Button>
              </div>
              {defects.length > 0 && (
                <div className="rounded border border-line overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-2 text-fg-2">
                      <tr>
                        <th className="px-2 py-1 text-left">分类</th>
                        <th className="px-2 py-1 text-left">名称</th>
                        <th className="px-2 py-1 text-right">数量</th>
                        <th className="px-2 py-1 text-left">单位</th>
                        <th className="px-2 py-1 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {defects.map((d, i) => (
                        <tr key={d.id || i} className="border-t border-line">
                          <td className="px-2 py-1">{d.defect_category}</td>
                          <td className="px-2 py-1">{d.defect_name}</td>
                          <td className="px-2 py-1 text-right font-mono">{d.defect_quantity}</td>
                          <td className="px-2 py-1">{d.unit || "—"}</td>
                          <td className="px-2 py-1 text-center">
                            <Button size="sm" variant="ghost" onClick={() => d.id && removeDefect(d.id)} className="h-5 text-xs text-rose-400">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm text-fg-1 mb-2 font-mono">异常工时（{downtimes.length} 条）</div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-2 text-xs">
                <select
                  value={dtDraft.anomaly_type}
                  onChange={(e) => setDtDraft({ ...dtDraft, anomaly_type: e.target.value as DowntimeDraft["anomaly_type"] })}
                  className="bg-bg-2 border border-line rounded px-2 py-1 text-fg-0"
                >
                  <option value="设备故障">设备故障</option>
                  <option value="来料不良">来料不良</option>
                  <option value="其它原因">其它原因</option>
                </select>
                <Input placeholder="设备编号" value={dtDraft.equipment_code} onChange={(e) => setDtDraft({ ...dtDraft, equipment_code: e.target.value })} className="h-7" />
                <Input placeholder="问题描述" value={dtDraft.problem_description} onChange={(e) => setDtDraft({ ...dtDraft, problem_description: e.target.value })} className="h-7" />
                <Input type="datetime-local" value={dtDraft.start_time} onChange={(e) => setDtDraft({ ...dtDraft, start_time: e.target.value })} className="h-7" />
                <Input type="datetime-local" value={dtDraft.end_time} onChange={(e) => setDtDraft({ ...dtDraft, end_time: e.target.value })} className="h-7" />
                <Button size="sm" onClick={addDowntime} disabled={submitting} className="h-7">
                  <Plus className="h-3 w-3 mr-1" />新增
                </Button>
              </div>
              {downtimes.length > 0 && (
                <div className="rounded border border-line overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-2 text-fg-2">
                      <tr>
                        <th className="px-2 py-1 text-left">类型</th>
                        <th className="px-2 py-1 text-left">设备</th>
                        <th className="px-2 py-1 text-left">描述</th>
                        <th className="px-2 py-1 text-left">停线</th>
                        <th className="px-2 py-1 text-left">恢复</th>
                        <th className="px-2 py-1 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downtimes.map((d, i) => (
                        <tr key={d.id || i} className="border-t border-line">
                          <td className="px-2 py-1">{d.anomaly_type}</td>
                          <td className="px-2 py-1 font-mono">{d.equipment_code || "—"}</td>
                          <td className="px-2 py-1">{d.problem_description || "—"}</td>
                          <td className="px-2 py-1 font-mono">{d.start_time}</td>
                          <td className="px-2 py-1 font-mono">{d.end_time}</td>
                          <td className="px-2 py-1 text-center">
                            <Button size="sm" variant="ghost" onClick={() => d.id && removeDowntime(d.id)} className="h-5 text-xs text-rose-400">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: 工单结束 */}
        {step === 3 && report && (
          <div className="space-y-4 mt-2">
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-fg-1">
              <div className="mb-1 font-semibold text-amber-500">报工结束前检查</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>投入数 {formatNumber(totalInput)}、合格数 {formatNumber(totalPass)}、不良数 {formatNumber(totalFail)}</li>
                <li>一致性：{consistencyOk ? <span className="text-emerald-500">✓ 投入 - 不良 = 合格</span> : <span className="text-rose-500">✗ 投入 - 不良 ≠ 合格，请回到步骤 2 修正</span>}</li>
                <li>工单计划数量：{formatNumber(workOrder.quantity)} {workOrder.unit}</li>
                <li>自动关闭条件：报工数量 ≥ 计划数量</li>
                <li>未达到计划数量时必须手工关闭</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => closeReport(false)}
                disabled={submitting || !consistencyOk || totalInput < workOrder.quantity}
                className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                自动关闭（达计划）
              </Button>
              <Button
                onClick={() => closeReport(true)}
                disabled={submitting || !consistencyOk}
                variant="outline"
                className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                手工关闭
              </Button>
            </div>
            <div className="text-xs text-fg-2">
              提示：关闭后报工批次不可再修改。如需多次报工，请先关闭当前批次再创建新批次。
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={submitting}>
              <ChevronLeft className="h-4 w-4 mr-1" />上一步
            </Button>
          )}
          {step === 1 && (
            <Button onClick={handleSubmitStep1} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              {isCreate ? <><Play className="h-4 w-4 mr-1" />创建批次</> : <><ChevronRight className="h-4 w-4 mr-1" />下一步</>}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!report} className="bg-orange-500 hover:bg-orange-600 text-white">
              下一步<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function updateOp(i: number, field: keyof OpDraft, v: number) {
    const next = [...opDrafts];
    next[i] = { ...next[i], [field]: v, saved: false };
    setOpDrafts(next);
  }
}

function initOpDraft(op: WorkOrderOperation): OpDraft {
  return {
    operation_seq: op.sequence,
    operation_name: op.operation_name || op.operation_code || "",
    input_quantity: 0,
    pass_quantity: 0,
    fail_quantity: 0,
    incoming_defect_piece: 0,
    incoming_defect_cover: 0,
    process_defect_piece: 0,
    process_defect_cover: 0,
    saved: false,
  };
}

function StepDot({ n, active, done, children }: { n: number; active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <div className={"flex items-center gap-1.5 " + (active ? "text-orange-500" : done ? "text-emerald-500" : "text-fg-3")}>
      <span className={"flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-mono " + (active ? "border-orange-500 bg-orange-500/10" : done ? "border-emerald-500 bg-emerald-500/10" : "border-line")}>
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-fg-2">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        className="h-8 mt-1 bg-bg-2 border-line text-fg-0"
      />
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      value={String(value || "")}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 text-right text-xs px-1 bg-bg-2 border-line"
    />
  );
}

function toLocalInputTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
