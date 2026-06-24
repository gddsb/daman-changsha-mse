"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  Save,
  Wrench,
  XCircle,
  Image as ImageIcon,
  AlertTriangle,
  PackageCheck,
  ClipboardList,
  ListChecks,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  WorkOrderReport,
  WorkOrderReportDetail,
  OperationReport,
  OperationDefect,
  EquipmentDowntime,
  ProcessInfo,
  WorkOrder,
} from "@/types/mes";
import { formatDateTime, formatNumber } from "@/lib/format";

interface ProcessItem {
  id: string;
  process_code: string;
  process_name: string;
  sequence: number;
}

interface ApiOk<T> { success: true; data: T }
interface ApiErr { success: false; error: string }
type ApiResp<T> = ApiOk<T> | ApiErr

/** 一道工序录入的本地草稿（按 operation_seq 索引） */
interface OpDraft {
  operation_seq: number;
  operation_name: string;
  input_quantity: number;
  pass_quantity: number;
  /** 自动汇总自该工序的 operation_defects（不在此录入） */
  fail_quantity: number;
  /** 已保存的 id（用于 upsert 后保持引用） */
  savedId?: string;
  /** 标记是否已脏（仅 input_quantity / pass_quantity 可改） */
  dirty?: boolean;
}

/** 新增不良草稿（每次一条） */
interface NewDefect {
  defect_category: "制程不良" | "来料不良";
  defect_name: string;
  defect_quantity: number;
  unit: "小片" | "带盖" | "";
}

/** 新增异常工时草稿 */
interface NewDowntime {
  anomaly_type: "设备故障" | "来料不良" | "其它原因";
  equipment_code: string;
  downtime_type: string;
  problem_description: string;
  start_time: string;
  end_time: string;
  confirmer: string;
}

/** 新增制程信息草稿 */
interface NewProcessInfo {
  operation_seq: number;
  operation_name: string;
  material_batch_no: string;
  quantity: number;
  material_label_image: string;
  incoming_defect_image: string;
  process_defect_image: string;
}

export function ReportDetailView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<WorkOrderReportDetail | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [opDrafts, setOpDrafts] = useState<Record<number, OpDraft>>({});
  /** 当前在不良 Tab 中选中的工序（operation_seq） */
  const [defectOpSeq, setDefectOpSeq] = useState<number | "">("");
  const [newDefect, setNewDefect] = useState<NewDefect>({
    defect_category: "制程不良",
    defect_name: "",
    defect_quantity: 0,
    unit: "小片",
  });
  const [newDowntime, setNewDowntime] = useState<NewDowntime>({
    anomaly_type: "设备故障",
    equipment_code: "",
    downtime_type: "故障停机",
    problem_description: "",
    start_time: "",
    end_time: "",
    confirmer: "当前用户",
  });
  const [newPI, setNewPI] = useState<NewProcessInfo>({
    operation_seq: 1,
    operation_name: "",
    material_batch_no: "",
    quantity: 0,
    material_label_image: "",
    incoming_defect_image: "",
    process_defect_image: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageHint, setPageHint] = useState<string | null>(null);

  /** 加载批次详情 + 工单 + 工序字典 */
  const loadAll = async () => {
    setLoading(true);
    setPageError(null);
    try {
      // 1) 批次详情
      const r = await fetch(`/api/reports/${reportId}`);
      const rj = (await r.json()) as ApiResp<WorkOrderReportDetail>;
      if (!rj.success) throw new Error(rj.error);
      setDetail(rj.data);
      const woId = rj.data.work_order_id;

      // 2) 工单详情
      const w = await fetch(`/api/work-orders/${woId}`);
      const wj = (await w.json()) as ApiResp<WorkOrder>;
      if (wj.success) setWorkOrder(wj.data);

      // 3) 工序字典（按 sequence 升序）
      const p = await fetch(`/api/process-dictionary`);
      const pj = (await p.json()) as ApiResp<ProcessItem[]>;
      if (pj.success) setProcesses(pj.data);

      // 4) 初始化草稿：每道工序一行
      //    fail_quantity 直接来自 operation_reports.fail_quantity（已被服务端汇总）
      const drafts: Record<number, OpDraft> = {};
      const ops = rj.data.operations ?? [];
      for (const proc of pj.success ? pj.data : []) {
        const seq = Number(proc.sequence ?? 0);
        if (seq <= 0) continue;
        const existing = ops.find((o) => Number(o.operation_seq) === seq);
        drafts[seq] = existing
          ? {
              operation_seq: seq,
              operation_name: existing.operation_name || proc.process_name,
              input_quantity: existing.input_quantity,
              pass_quantity: existing.pass_quantity,
              fail_quantity: existing.fail_quantity,
              savedId: existing.id,
              dirty: false,
            }
          : {
              operation_seq: seq,
              operation_name: proc.process_name,
              input_quantity: 0,
              pass_quantity: 0,
              fail_quantity: 0,
              dirty: false,
            };
      }
      setOpDrafts(drafts);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  /** 累计（input / pass / fail 总和） */
  const aggregate = useMemo(() => {
    const all = Object.values(opDrafts);
    return {
      input: all.reduce((s, o) => s + (Number(o.input_quantity) || 0), 0),
      pass: all.reduce((s, o) => s + (Number(o.pass_quantity) || 0), 0),
      fail: all.reduce((s, o) => s + (Number(o.fail_quantity) || 0), 0),
      saved: all.filter((o) => !!o.savedId).length,
      total: all.length,
    };
  }, [opDrafts]);

  /** 整体一致性（按整批次聚合）：input = pass + fail */
  const consistencyOk = useMemo(() => {
    if (aggregate.input <= 0) return null;
    return aggregate.input === aggregate.pass + aggregate.fail;
  }, [aggregate]);

  /** 当前批次是否已关闭 */
  const isClosed = !!detail?.is_closed;

  /** 已报工的工序（用于不良 Tab 中选择） */
  const reportedOps = useMemo(
    () => Object.values(opDrafts).filter((o) => !!o.savedId).sort((a, b) => a.operation_seq - b.operation_seq),
    [opDrafts]
  );

  /** 当前 defectOpSeq 对应的 operation_report.id（用于 POST defects） */
  const currentOpReport = useMemo(() => {
    if (defectOpSeq === "") return null;
    return opDrafts[defectOpSeq] ?? null;
  }, [defectOpSeq, opDrafts]);

  /** 该工序已有不良列表（来自 detail.defects，按 operation_report_id 过滤） */
  const currentDefects = useMemo(() => {
    if (!currentOpReport?.savedId) return [];
    return (detail?.defects ?? []).filter((d) => d.operation_report_id === currentOpReport.savedId);
  }, [currentOpReport, detail]);

  /** 提交单道工序报工（upsert） */
  const saveOpDraft = async (draft: OpDraft) => {
    if (!detail) return;
    if (isClosed) {
      setPageError("报工批次已关闭，不能修改工序报工");
      return;
    }
    if (draft.input_quantity === 0 && draft.pass_quantity === 0) {
      setPageError(`工序 ${draft.operation_seq} 投入/合格均为 0，未保存`);
      return;
    }
    setSaving(true);
    setPageError(null);
    setPageHint(null);
    try {
      const r = await fetch(`/api/reports/${detail.id}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_order_report_id: detail.id,
          operation_seq: draft.operation_seq,
          operation_name: draft.operation_name,
          input_quantity: draft.input_quantity,
          pass_quantity: draft.pass_quantity,
        }),
      });
      const j = (await r.json()) as ApiResp<OperationReport>;
      if (!j.success) throw new Error(j.error);
      setPageHint(`工序 ${draft.operation_seq} 报工已保存`);
      await loadAll();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 提交所有脏工序 */
  const saveAllDirty = async () => {
    const dirty = Object.values(opDrafts).filter((o) => o.dirty);
    if (dirty.length === 0) {
      setPageHint("没有需要保存的工序报工");
      return;
    }
    for (const d of dirty) {
      await saveOpDraft(d);
    }
  };

  /** 关闭批次（手工） */
  const closeReport = async () => {
    if (!detail) return;
    if (!confirm("确认关闭该报工批次？关闭后不可修改。")) return;
    setSaving(true);
    setPageError(null);
    try {
      const r = await fetch(`/api/reports/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", manual: true }),
      });
      const j = (await r.json()) as ApiResp<WorkOrderReport>;
      if (!j.success) throw new Error(j.error);
      setPageHint("批次已关闭");
      await loadAll();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "关闭失败");
    } finally {
      setSaving(false);
    }
  };

  /** 新增不良（按 operation_report_id） */
  const addDefect = async () => {
    if (!detail) return;
    if (isClosed) {
      setPageError("报工批次已关闭，不能新增不良");
      return;
    }
    if (!currentOpReport?.savedId) {
      setPageError("请先在工序报工 Tab 中保存该工序的报工数据");
      return;
    }
    if (!newDefect.defect_name.trim() || newDefect.defect_quantity <= 0) {
      setPageError("请填写不良名称和数量");
      return;
    }
    setSaving(true);
    setPageError(null);
    try {
      const r = await fetch(`/api/reports/${detail.id}/defects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_report_id: currentOpReport.savedId,
          defect_category: newDefect.defect_category,
          defect_name: newDefect.defect_name,
          defect_quantity: newDefect.defect_quantity,
          unit: newDefect.unit || null,
        }),
      });
      const j = (await r.json()) as ApiResp<OperationDefect>;
      if (!j.success) throw new Error(j.error);
      setNewDefect({ ...newDefect, defect_name: "", defect_quantity: 0 });
      setPageHint("不良已记录");
      await loadAll();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 删除不良 */
  const removeDefect = async (id: string) => {
    if (!detail) return;
    if (isClosed) return;
    if (!confirm("确认删除该不良记录？")) return;
    const r = await fetch(`/api/reports/${detail.id}/defects?defect_id=${id}`, { method: "DELETE" });
    const j = (await r.json()) as ApiResp<{ ok: boolean }>;
    if (!j.success) {
      setPageError(j.error);
      return;
    }
    await loadAll();
  };

  /** 新增异常工时 */
  const addDowntime = async () => {
    if (!detail) return;
    if (!newDowntime.start_time || !newDowntime.end_time) {
      setPageError("请填写停线开始/生产恢复时间");
      return;
    }
    if (new Date(newDowntime.end_time).getTime() < new Date(newDowntime.start_time).getTime()) {
      setPageError("生产恢复时间不能小于停线开始时间");
      return;
    }
    setSaving(true);
    setPageError(null);
    try {
      const r = await fetch(`/api/reports/${detail.id}/downtimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newDowntime, work_order_report_id: detail.id }),
      });
      const j = (await r.json()) as ApiResp<EquipmentDowntime>;
      if (!j.success) throw new Error(j.error);
      setNewDowntime({ ...newDowntime, problem_description: "" });
      setPageHint("异常工时已记录");
      await loadAll();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeDowntime = async (id: string) => {
    if (!detail) return;
    if (isClosed) return;
    if (!confirm("确认删除该异常工时？")) return;
    const r = await fetch(`/api/reports/${detail.id}/downtimes?downtime_id=${id}`, { method: "DELETE" });
    const j = (await r.json()) as ApiResp<{ ok: boolean }>;
    if (!j.success) {
      setPageError(j.error);
      return;
    }
    await loadAll();
  };

  /** 新增制程信息 */
  const addPI = async () => {
    if (!detail) return;
    if (newPI.material_batch_no.trim() === "") {
      setPageError("请填写物料批号");
      return;
    }
    setSaving(true);
    setPageError(null);
    try {
      const r = await fetch(`/api/reports/${detail.id}/process-infos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newPI, work_order_report_id: detail.id }),
      });
      const j = (await r.json()) as ApiResp<ProcessInfo>;
      if (!j.success) throw new Error(j.error);
      setPageHint("制程信息已记录");
      setNewPI({ ...newPI, material_batch_no: "", quantity: 0 });
      await loadAll();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removePI = async (id: string) => {
    if (!detail) return;
    if (isClosed) return;
    if (!confirm("确认删除该制程信息？")) return;
    const r = await fetch(`/api/reports/${detail.id}/process-infos?process_info_id=${id}`, { method: "DELETE" });
    const j = (await r.json()) as ApiResp<{ ok: boolean }>;
    if (!j.success) {
      setPageError(j.error);
      return;
    }
    await loadAll();
  };

  if (loading && !detail) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载报工批次...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <div className="text-rose-400">批次不存在或加载失败：{pageError}</div>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/reports")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回报工列表
        </Button>
      </div>
    );
  }

  const sortedSeq = Object.keys(opDrafts).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 顶部抬头 */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-300" onClick={() => router.push("/reports")}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> 返回列表
              </Button>
              <span>/</span>
              <span>报工批次 {detail.report_no}</span>
            </div>
            <CardTitle className="flex items-center gap-3 text-slate-100">
              <span className="font-mono text-lg">{detail.batch_no}</span>
              <span className="text-sm text-slate-400">完工顺序 #{detail.completion_seq}</span>
              {detail.is_closed ? (
                <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 已关闭
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  <Circle className="h-3.5 w-3.5 fill-emerald-400" /> 进行中
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-slate-400">
              工单 {detail.work_order_no} · {workOrder?.product_name ?? "-"} · {workOrder?.specification ?? "-"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadAll()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> 刷新
            </Button>
            <Button
              size="sm"
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={isClosed || saving}
              onClick={closeReport}
            >
              <PackageCheck className="mr-1 h-3.5 w-3.5" /> 关闭报工
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-sm md:grid-cols-4 lg:grid-cols-6">
          <Field label="开工时间">{formatDateTime(detail.start_time)}</Field>
          <Field label="完工时间">{detail.end_time ? formatDateTime(detail.end_time) : "—"}</Field>
          <Field label="关闭类型">{detail.close_type ? (detail.close_type === "auto" ? "自动" : "手工") : "—"}</Field>
          <Field label="技工人数">{formatNumber(detail.skilled_worker_count)}</Field>
          <Field label="普工人数">{formatNumber(detail.regular_worker_count)}</Field>
          <Field label="劳务人工">{formatNumber(detail.contract_worker_count)}</Field>
          <Field label="其它人工">{formatNumber(detail.other_worker_count)}</Field>
          <Field label="累计投入">{formatNumber(aggregate.input)}</Field>
          <Field label="累计合格">{formatNumber(aggregate.pass)}</Field>
          <Field label="累计不良">
            <span className="text-amber-400">{formatNumber(aggregate.fail)}</span>
            <span className="ml-1 text-[10px] text-slate-500">（自动汇总）</span>
          </Field>
          <Field label="已录工序">
            {aggregate.saved} / {aggregate.total}
          </Field>
          <Field label="一致性（投=合+不良）">
            {consistencyOk === null ? (
              <span className="text-slate-500">未录入</span>
            ) : consistencyOk ? (
              <span className="text-emerald-400">通过</span>
            ) : (
              <span className="text-rose-400">不合格</span>
            )}
          </Field>
        </CardContent>
      </Card>

      {pageError ? (
        <div className="flex items-center gap-2 rounded border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-300">
          <AlertTriangle className="h-4 w-4" /> {pageError}
        </div>
      ) : null}
      {pageHint ? (
        <div className="flex items-center gap-2 rounded border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {pageHint}
        </div>
      ) : null}

      <Tabs defaultValue="operations" className="w-full">
        <TabsList className="border-b border-slate-800 bg-slate-900">
          <TabsTrigger value="operations" className="data-[state=active]:bg-slate-800">
            <ClipboardList className="mr-1.5 h-4 w-4" /> 工序报工
          </TabsTrigger>
          <TabsTrigger value="defects" className="data-[state=active]:bg-slate-800">
            <XCircle className="mr-1.5 h-4 w-4" /> 工序不良 ({detail.defects?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="downtimes" className="data-[state=active]:bg-slate-800">
            <Wrench className="mr-1.5 h-4 w-4" /> 异常工时 ({detail.downtimes?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="process" className="data-[state=active]:bg-slate-800">
            <ImageIcon className="mr-1.5 h-4 w-4" /> 制程信息 ({detail.process_infos?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* 工序报工 */}
        <TabsContent value="operations" className="mt-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-slate-100">工序报工明细</CardTitle>
                <CardDescription className="text-slate-400">
                  录入投入/合格；不良由「工序不良」Tab 选择该工序后自动汇总
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="bg-orange-500 text-white hover:bg-orange-600"
                onClick={saveAllDirty}
                disabled={isClosed || saving}
              >
                <Save className="mr-1.5 h-4 w-4" /> 保存所有脏数据
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase text-slate-300">
                    <th className="px-2 py-2 text-left">工序</th>
                    <th className="px-2 py-2 text-right">投入</th>
                    <th className="px-2 py-2 text-right">合格</th>
                    <th className="px-2 py-2 text-right">不良（自动汇总）</th>
                    <th className="px-2 py-2 text-center">一致性</th>
                    <th className="px-2 py-2 text-center">状态</th>
                    <th className="px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSeq.map((seq) => {
                    const d = opDrafts[seq];
                    const sumOk =
                      d.input_quantity === d.pass_quantity + d.fail_quantity && d.input_quantity > 0;
                    return (
                      <tr key={seq} className="border-b border-slate-800 text-slate-200">
                        <td className="px-2 py-2 align-top">
                          <div className="font-mono text-xs text-slate-400">#{seq}</div>
                          <div className="text-slate-100">{d.operation_name}</div>
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <Input
                            type="number"
                            min={0}
                            value={d.input_quantity || ""}
                            disabled={isClosed}
                            onChange={(e) =>
                              setOpDrafts({
                                ...opDrafts,
                                [seq]: { ...d, input_quantity: Number(e.target.value) || 0, dirty: true },
                              })
                            }
                            className="h-7 w-24 border-slate-700 bg-slate-950 text-right text-slate-100"
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <Input
                            type="number"
                            min={0}
                            value={d.pass_quantity || ""}
                            disabled={isClosed}
                            onChange={(e) =>
                              setOpDrafts({
                                ...opDrafts,
                                [seq]: { ...d, pass_quantity: Number(e.target.value) || 0, dirty: true },
                              })
                            }
                            className="h-7 w-24 border-slate-700 bg-slate-950 text-right text-slate-100"
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <div className="flex h-7 w-24 items-center justify-end rounded border border-slate-800 bg-slate-900 px-2 text-right font-mono text-amber-400">
                            {formatNumber(d.fail_quantity)}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center align-top">
                          {d.input_quantity === 0 ? (
                            <span className="text-slate-500">未录入</span>
                          ) : sumOk ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 一致
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> 不一致
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center align-top">
                          {d.savedId ? (
                            d.dirty ? (
                              <span className="text-amber-400">待保存</span>
                            ) : (
                              <span className="flex items-center justify-center gap-1 text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" /> 已保存
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">未录入</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center align-top">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                            disabled={isClosed || saving}
                            onClick={() => void saveOpDraft(d)}
                          >
                            保存
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 工序不良 — 按工序选择录入 */}
        <TabsContent value="defects" className="mt-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-100">工序不良登记</CardTitle>
              <CardDescription className="text-slate-400">
                选择工序 → 录入该工序的多条不良；该工序的「不良（自动汇总）」= SUM(defect_quantity)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* 工序选择 */}
              <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
                <label className="text-xs uppercase tracking-wider text-slate-500 md:w-20">选择工序</label>
                <div className="relative md:w-80">
                  <select
                    value={defectOpSeq === "" ? "" : defectOpSeq}
                    disabled={isClosed}
                    onChange={(e) => setDefectOpSeq(e.target.value ? Number(e.target.value) : "")}
                    className="h-9 w-full appearance-none rounded border border-slate-700 bg-slate-950 px-2 pr-8 text-sm text-slate-100"
                  >
                    <option value="">-- 请选择已报工的工序 --</option>
                    {reportedOps.map((o) => (
                      <option key={o.operation_seq} value={o.operation_seq}>
                        #{o.operation_seq} {o.operation_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                {defectOpSeq !== "" ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>已选：</span>
                    <span className="font-mono text-amber-400">
                      #{defectOpSeq} {opDrafts[defectOpSeq]?.operation_name}
                    </span>
                    <span>· 汇总不良：</span>
                    <span className="font-mono text-amber-300">
                      {formatNumber(currentOpReport?.fail_quantity ?? 0)}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    {reportedOps.length === 0 ? "暂无已报工工序，请先在「工序报工」Tab 保存工序数据" : "请选择一道工序"}
                  </div>
                )}
              </div>

              {/* 新增不良表单 */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                <select
                  value={newDefect.defect_category}
                  disabled={isClosed || !currentOpReport?.savedId}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_category: e.target.value as NewDefect["defect_category"] })}
                  className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value="制程不良">制程不良</option>
                  <option value="来料不良">来料不良</option>
                </select>
                <Input
                  placeholder="不良名称"
                  value={newDefect.defect_name}
                  disabled={isClosed || !currentOpReport?.savedId}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_name: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="数量"
                  value={newDefect.defect_quantity || ""}
                  disabled={isClosed || !currentOpReport?.savedId}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_quantity: Number(e.target.value) || 0 })}
                  className="border-slate-700 bg-slate-950 text-right text-slate-100 disabled:opacity-50"
                />
                <select
                  value={newDefect.unit}
                  disabled={isClosed || !currentOpReport?.savedId}
                  onChange={(e) => setNewDefect({ ...newDefect, unit: e.target.value as NewDefect["unit"] })}
                  className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value="小片">小片</option>
                  <option value="带盖">带盖</option>
                </select>
                <Button
                  size="sm"
                  className="bg-orange-500 text-white hover:bg-orange-600 md:col-span-2 disabled:opacity-50"
                  onClick={addDefect}
                  disabled={isClosed || saving || !currentOpReport?.savedId}
                >
                  <ListChecks className="mr-1.5 h-4 w-4" /> 新增不良（按工序）
                </Button>
              </div>

              {/* 该工序已有不良 */}
              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                  {defectOpSeq !== "" ? `#${defectOpSeq} 已有不良 (${currentDefects.length})` : "请先选择工序"}
                </div>
                <DefectsTable defects={currentDefects} onRemove={removeDefect} isClosed={isClosed} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 异常工时 */}
        <TabsContent value="downtimes" className="mt-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-100">异常工时登记</CardTitle>
              <CardDescription className="text-slate-400">设备故障/来料不良/其它原因停线记录</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  value={newDowntime.anomaly_type}
                  onChange={(e) => setNewDowntime({ ...newDowntime, anomaly_type: e.target.value as NewDowntime["anomaly_type"] })}
                  className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
                >
                  <option value="设备故障">设备故障</option>
                  <option value="来料不良">来料不良</option>
                  <option value="其它原因">其它原因</option>
                </select>
                <Input
                  placeholder="设备编号"
                  value={newDowntime.equipment_code}
                  onChange={(e) => setNewDowntime({ ...newDowntime, equipment_code: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  placeholder="停机类型"
                  value={newDowntime.downtime_type}
                  onChange={(e) => setNewDowntime({ ...newDowntime, downtime_type: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  placeholder="确认人"
                  value={newDowntime.confirmer}
                  onChange={(e) => setNewDowntime({ ...newDowntime, confirmer: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  type="datetime-local"
                  value={newDowntime.start_time}
                  onChange={(e) => setNewDowntime({ ...newDowntime, start_time: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100"
                />
                <Input
                  type="datetime-local"
                  value={newDowntime.end_time}
                  onChange={(e) => setNewDowntime({ ...newDowntime, end_time: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100"
                />
                <Input
                  placeholder="问题描述"
                  value={newDowntime.problem_description}
                  onChange={(e) => setNewDowntime({ ...newDowntime, problem_description: e.target.value })}
                  className="md:col-span-1 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={addDowntime} disabled={saving}>
                  <Save className="mr-1.5 h-4 w-4" /> 记录
                </Button>
              </div>
              <DowntimesTable rows={detail.downtimes ?? []} onRemove={removeDowntime} isClosed={isClosed} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 制程信息 */}
        <TabsContent value="process" className="mt-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-100">制程信息登记</CardTitle>
              <CardDescription className="text-slate-400">物料批号/数量/图片留痕</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  value={newPI.operation_seq}
                  onChange={(e) => {
                    const seq = Number(e.target.value);
                    const proc = processes.find((p) => Number(p.sequence) === seq);
                    setNewPI({ ...newPI, operation_seq: seq, operation_name: proc?.process_name ?? "" });
                  }}
                  className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
                >
                  {processes.map((p) => (
                    <option key={p.id} value={Number(p.sequence)}>
                      #{p.sequence} {p.process_name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="物料批号"
                  value={newPI.material_batch_no}
                  onChange={(e) => setNewPI({ ...newPI, material_batch_no: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="数量"
                  value={newPI.quantity || ""}
                  onChange={(e) => setNewPI({ ...newPI, quantity: Number(e.target.value) || 0 })}
                  className="border-slate-700 bg-slate-950 text-right text-slate-100"
                />
                <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={addPI} disabled={saving}>
                  <Save className="mr-1.5 h-4 w-4" /> 记录
                </Button>
                <Input
                  placeholder="物料标签图片 URL"
                  value={newPI.material_label_image}
                  onChange={(e) => setNewPI({ ...newPI, material_label_image: e.target.value })}
                  className="md:col-span-2 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  placeholder="来料不良图片 URL"
                  value={newPI.incoming_defect_image}
                  onChange={(e) => setNewPI({ ...newPI, incoming_defect_image: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
                <Input
                  placeholder="制程不良图片 URL"
                  value={newPI.process_defect_image}
                  onChange={(e) => setNewPI({ ...newPI, process_defect_image: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                />
              </div>
              <ProcessInfoTable rows={detail.process_infos ?? []} onRemove={removePI} isClosed={isClosed} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-100">{children}</div>
    </div>
  );
}

function DefectsTable({ defects, onRemove, isClosed }: { defects: OperationDefect[]; onRemove: (id: string) => void; isClosed: boolean }) {
  if (defects.length === 0) {
    return <div className="rounded border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">该工序暂无不良记录</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase text-slate-300">
          <th className="px-2 py-2 text-left">不良分类</th>
          <th className="px-2 py-2 text-left">不良名称</th>
          <th className="px-2 py-2 text-right">数量</th>
          <th className="px-2 py-2 text-left">单位</th>
          <th className="px-2 py-2 text-left">登记时间</th>
          <th className="px-2 py-2 text-center">操作</th>
        </tr>
      </thead>
      <tbody>
        {defects.map((d) => (
          <tr key={d.id} className="border-b border-slate-800 text-slate-200">
            <td className="px-2 py-1.5">{d.defect_category}</td>
            <td className="px-2 py-1.5">{d.defect_name}</td>
            <td className="px-2 py-1.5 text-right font-mono">{formatNumber(d.defect_quantity)}</td>
            <td className="px-2 py-1.5">{d.unit ?? "—"}</td>
            <td className="px-2 py-1.5 text-slate-400">{formatDateTime(d.created_at)}</td>
            <td className="px-2 py-1.5 text-center">
              <Button size="sm" variant="ghost" className="h-6 text-rose-400" disabled={isClosed} onClick={() => onRemove(d.id)}>
                删除
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DowntimesTable({ rows, onRemove, isClosed }: { rows: EquipmentDowntime[]; onRemove: (id: string) => void; isClosed: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">暂无异常工时</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase text-slate-300">
          <th className="px-2 py-2 text-left">异常类型</th>
          <th className="px-2 py-2 text-left">设备</th>
          <th className="px-2 py-2 text-left">停机类型</th>
          <th className="px-2 py-2 text-left">开始</th>
          <th className="px-2 py-2 text-left">恢复</th>
          <th className="px-2 py-2 text-right">时长(min)</th>
          <th className="px-2 py-2 text-left">确认人</th>
          <th className="px-2 py-2 text-left">描述</th>
          <th className="px-2 py-2 text-center">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id} className="border-b border-slate-800 text-slate-200">
            <td className="px-2 py-1.5">{d.anomaly_type}</td>
            <td className="px-2 py-1.5 font-mono">{d.equipment_code || "—"}</td>
            <td className="px-2 py-1.5">{d.downtime_type || "—"}</td>
            <td className="px-2 py-1.5 text-slate-400">{formatDateTime(d.start_time)}</td>
            <td className="px-2 py-1.5 text-slate-400">{formatDateTime(d.end_time)}</td>
            <td className="px-2 py-1.5 text-right font-mono">{formatNumber(d.duration_minutes)}</td>
            <td className="px-2 py-1.5">{d.confirmer || "—"}</td>
            <td className="px-2 py-1.5 text-slate-400">{d.problem_description || "—"}</td>
            <td className="px-2 py-1.5 text-center">
              <Button size="sm" variant="ghost" className="h-6 text-rose-400" disabled={isClosed} onClick={() => onRemove(d.id)}>
                删除
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProcessInfoTable({ rows, onRemove, isClosed }: { rows: ProcessInfo[]; onRemove: (id: string) => void; isClosed: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">暂无制程信息</div>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase text-slate-300">
          <th className="px-2 py-2 text-left">工序</th>
          <th className="px-2 py-2 text-left">物料批号</th>
          <th className="px-2 py-2 text-right">数量</th>
          <th className="px-2 py-2 text-left">标签图</th>
          <th className="px-2 py-2 text-left">来料图</th>
          <th className="px-2 py-2 text-left">制程图</th>
          <th className="px-2 py-2 text-center">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-800 text-slate-200">
            <td className="px-2 py-1.5">
              <div className="text-xs text-slate-400">#{r.operation_seq}</div>
              <div>{r.operation_name}</div>
            </td>
            <td className="px-2 py-1.5 font-mono">{r.material_batch_no || "—"}</td>
            <td className="px-2 py-1.5 text-right font-mono">{formatNumber(r.quantity)}</td>
            <td className="px-2 py-1.5 text-xs text-slate-400">{r.material_label_image || "—"}</td>
            <td className="px-2 py-1.5 text-xs text-slate-400">{r.incoming_defect_image || "—"}</td>
            <td className="px-2 py-1.5 text-xs text-slate-400">{r.process_defect_image || "—"}</td>
            <td className="px-2 py-1.5 text-center">
              <Button size="sm" variant="ghost" className="h-6 text-rose-400" disabled={isClosed} onClick={() => onRemove(r.id)}>
                删除
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
