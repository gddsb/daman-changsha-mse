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

/** 一道工序的汇总展示数据（只读） */
interface OpSummary {
  operation_seq: number;
  operation_name: string;
  /** 投入数：首道=制程信息汇总，后续=上一道合格数 */
  input_quantity: number;
  /** 合格数 = 投入 - 不良 */
  pass_quantity: number;
  /** 不良总数（汇总自 operation_defects） */
  fail_quantity: number;
  /** 来料不良-小片 */
  incoming_piece: number;
  /** 来料不良-带盖 */
  incoming_cover: number;
  /** 制程不良-小片 */
  process_piece: number;
  /** 制程不良-带盖 */
  process_cover: number;
}

/** 计算工序汇总数据：投入数和不良分类 */
function computeOpSummary(
  ops: OperationReport[],
  defects: OperationDefect[],
  processInfos: ProcessInfo[]
): Record<number, OpSummary> {
  const result: Record<number, OpSummary> = {};
  const sortedOps = [...ops].sort((a, b) => a.operation_seq - b.operation_seq);
  
  let prevPass = 0;
  for (const op of sortedOps) {
    const seq = op.operation_seq;
    // 投入数：首道 = 制程信息汇总，后续 = 上一道合格数
    const input = seq === 1
      ? processInfos.filter(p => p.operation_seq === 1).reduce((s, p) => s + (p.quantity || 0), 0)
      : prevPass;
    
    // 不良分类汇总
    const opDefects = defects.filter(d => d.operation_seq === seq);
    const incoming_piece = opDefects.filter(d => d.defect_category === "来料不良" && d.unit === "小片").reduce((s, d) => s + (d.defect_quantity || 0), 0);
    const incoming_cover = opDefects.filter(d => d.defect_category === "来料不良" && d.unit === "带盖").reduce((s, d) => s + (d.defect_quantity || 0), 0);
    const process_piece = opDefects.filter(d => d.defect_category === "制程不良" && d.unit === "小片").reduce((s, d) => s + (d.defect_quantity || 0), 0);
    const process_cover = opDefects.filter(d => d.defect_category === "制程不良" && d.unit === "带盖").reduce((s, d) => s + (d.defect_quantity || 0), 0);
    const fail = incoming_piece + incoming_cover + process_piece + process_cover;
    
    // 合格数 = 投入 - 不良
    const pass = input - fail;
    prevPass = pass;
    
    result[seq] = {
      operation_seq: seq,
      operation_name: op.operation_name,
      input_quantity: input,
      pass_quantity: pass,
      fail_quantity: fail,
      incoming_piece,
      incoming_cover,
      process_piece,
      process_cover,
    };
  }
  return result;
}

/** 新增不良草稿（每次一条） */
interface NewDefect {
  defect_category: "制程不良" | "来料不良" | "检验报废";
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
  material_label_image: string[];  // 多图数组
  incoming_defect_image: string[];  // 多图数组
  process_defect_image: string[];  // 多图数组
}

export function ReportDetailView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<WorkOrderReportDetail | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  /** 新增不良时选择的工序 */
  const [defectOpSeq, setDefectOpSeq] = useState<number | "">("");
  /** 筛选不良记录的工序 */
  const [defectOpSeqFilter, setDefectOpSeqFilter] = useState<number | "">("");
  /** 筛选异常工时的类型 */
  const [downtimeTypeFilter, setDowntimeTypeFilter] = useState<string>("");
  /** 筛选制程信息的工序 */
  const [processOpSeqFilter, setProcessOpSeqFilter] = useState<number | "">("");
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
    material_label_image: [],
    incoming_defect_image: [],
    process_defect_image: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageHint, setPageHint] = useState<string | null>(null);

  /** 筛选后的不良记录 */
  const filteredDefects = useMemo(() => {
    if (!detail?.defects) return [];
    if (defectOpSeqFilter === "") return detail.defects;
    return detail.defects.filter(d => d.operation_seq === defectOpSeqFilter);
  }, [detail?.defects, defectOpSeqFilter]);

  /** 筛选后的异常工时记录 */
  const filteredDowntimes = useMemo(() => {
    if (!detail?.downtimes) return [];
    if (downtimeTypeFilter === "") return detail.downtimes;
    return detail.downtimes.filter(d => d.anomaly_type === downtimeTypeFilter);
  }, [detail?.downtimes, downtimeTypeFilter]);

  /** 筛选后的制程信息记录 */
  const filteredProcessInfos = useMemo(() => {
    if (!detail?.process_infos) return [];
    if (processOpSeqFilter === "") return detail.process_infos;
    return detail.process_infos.filter(p => p.operation_seq === processOpSeqFilter);
  }, [detail?.process_infos, processOpSeqFilter]);

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

      // 工序报工数据直接从 detail.operations 读取，不再初始化本地草稿
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

  /** 工序汇总数据（按工序顺序计算投入数） */
  const opSummaries = useMemo(() => {
    if (!detail || !processes.length) return [];
    
    // 按 operation_seq 排序的工序
    const sortedOps = [...detail.operations].sort((a, b) => a.operation_seq - b.operation_seq);
    
    // 首道投入 = 制程信息汇总
    const firstInput = detail.process_infos
      .filter((pi) => pi.operation_seq === 1)
      .reduce((s, pi) => s + (Number(pi.quantity) || 0), 0);
    
    // 计算每道工序的汇总数据
    const results: OpSummary[] = [];
    let prevPass = 0;
    
    for (let i = 0; i < sortedOps.length; i++) {
      const op = sortedOps[i];
      const input = i === 0 ? firstInput : prevPass;
      const fail = op.fail_quantity;
      const pass = input - fail;
      prevPass = pass;
      
      // 从 defects 按4类汇总
      const opDefects = detail.defects.filter((d) => d.operation_seq === op.operation_seq);
      const incomingPiece = opDefects
        .filter((d) => d.defect_category === "来料不良" && d.unit === "小片")
        .reduce((s, d) => s + (Number(d.defect_quantity) || 0), 0);
      const incomingCover = opDefects
        .filter((d) => d.defect_category === "来料不良" && d.unit === "带盖")
        .reduce((s, d) => s + (Number(d.defect_quantity) || 0), 0);
      const processPiece = opDefects
        .filter((d) => d.defect_category === "制程不良" && d.unit === "小片")
        .reduce((s, d) => s + (Number(d.defect_quantity) || 0), 0);
      const processCover = opDefects
        .filter((d) => d.defect_category === "制程不良" && d.unit === "带盖")
        .reduce((s, d) => s + (Number(d.defect_quantity) || 0), 0);
      
      results.push({
        operation_seq: op.operation_seq,
        operation_name: op.operation_name,
        input_quantity: input,
        pass_quantity: pass,
        fail_quantity: fail,
        incoming_piece: incomingPiece,
        incoming_cover: incomingCover,
        process_piece: processPiece,
        process_cover: processCover,
      });
    }
    
    // 补齐未报工工序（从 process_dictionary）
    for (const proc of processes) {
      if (!results.find((r) => r.operation_seq === proc.sequence)) {
        const input = results.length === 0 ? firstInput : prevPass;
        results.push({
          operation_seq: proc.sequence,
          operation_name: proc.process_name,
          input_quantity: input,
          pass_quantity: 0,
          fail_quantity: 0,
          incoming_piece: 0,
          incoming_cover: 0,
          process_piece: 0,
          process_cover: 0,
        });
        prevPass = input; // 未报工工序假设 pass = input
      }
    }
    
    return results.sort((a, b) => a.operation_seq - b.operation_seq);
  }, [detail, processes]);

  /** 累计（input / pass / fail 总和） */
  const aggregate = useMemo(() => {
    if (!opSummaries.length) return { input: 0, pass: 0, fail: 0 };
    return {
      input: opSummaries.reduce((s, o) => s + o.input_quantity, 0),
      pass: opSummaries.reduce((s, o) => s + o.pass_quantity, 0),
      fail: opSummaries.reduce((s, o) => s + o.fail_quantity, 0),
    };
  }, [opSummaries]);

  /** 整体一致性（关闭时校验）：input = pass + fail */
  const consistencyOk = useMemo(() => {
    if (aggregate.input <= 0) return null;
    return aggregate.input === aggregate.pass + aggregate.fail;
  }, [aggregate]);

  /** 当前批次是否已关闭 */
  const isClosed = !!detail?.is_closed;

  /** 工单的所有工序（用于不良 Tab 中选择工序） */
  const reportedOps = useMemo(
    () => detail?.work_order_operations?.sort((a, b) => a.sequence - b.sequence) ?? [],
    [detail]
  );

  /** 当前 defectOpSeq 对应的 operation_report（可能不存在，需要自动创建） */
  const currentOpReport = useMemo(() => {
    if (defectOpSeq === "" || !detail) return null;
    return detail.operations.find((o) => o.operation_seq === defectOpSeq) ?? null;
  }, [defectOpSeq, detail]);

  /** 当前选择的工序信息（从工单工序列表获取） */
  const currentWoOp = useMemo(() => {
    if (defectOpSeq === "" || !detail) return null;
    return detail.work_order_operations?.find((o) => o.sequence === defectOpSeq) ?? null;
  }, [defectOpSeq, detail]);

  /** 该工序已有不良列表（来自 detail.defects，按 operation_seq 过滤） */
  const currentDefects = useMemo(() => {
    if (defectOpSeq === "" || !detail) return [];
    return (detail?.defects ?? []).filter((d) => d.operation_seq === defectOpSeq);
  }, [defectOpSeq, detail]);

  /** 工序汇总数据（投入/合格/不良，自动计算） */
  const opSummary = useMemo<Record<number, OpSummary>>(() => {
    if (!detail) return {};
    return computeOpSummary(detail.operations, detail.defects, detail.process_infos);
  }, [detail]);

  // 工序报工已改为纯汇总视图，不再需要保存功能

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

  /** 新增不良（支持自动创建工序报工记录） */
  const addDefect = async () => {
    if (!detail) return;
    if (isClosed) {
      setPageError("报工批次已关闭，不能新增不良");
      return;
    }
    if (defectOpSeq === "") {
      setPageError("请先选择工序");
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
          // 如果已有 operation_report 则直接使用，否则传 operation_seq 让 API 自动创建
          operation_report_id: currentOpReport?.id ?? undefined,
          work_order_report_id: detail.id,
          operation_seq: defectOpSeq,
          operation_name: currentWoOp?.operation_name ?? `工序${defectOpSeq}`,
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
    // 开始时间不能早于本次开工时间
    if (detail.start_time && new Date(newDowntime.start_time).getTime() < new Date(detail.start_time).getTime()) {
      setPageError("开始时间不能早于本次开工时间");
      return;
    }
    // 结束时间不能晚于当前时间
    if (new Date(newDowntime.end_time).getTime() > new Date().getTime()) {
      setPageError("结束时间不能晚于当前时间");
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
      setNewPI({ ...newPI, material_batch_no: "", quantity: 0, material_label_image: [], incoming_defect_image: [], process_defect_image: [] });
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

  const sortedSeq = Object.keys(opSummary).map(Number).sort((a, b) => a - b);

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

        {/* 工序报工明细（纯汇总展示） */}
        <TabsContent value="operations" className="mt-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-100">工序报工明细</CardTitle>
              <CardDescription className="text-slate-400">
                投入数自动计算：首道=制程信息汇总，后续=上一道合格；不良按4类汇总自「工序不良」Tab
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase text-slate-300">
                    <th className="px-2 py-2 text-left">工序</th>
                    <th className="px-2 py-2 text-right">投入</th>
                    <th className="px-2 py-2 text-right">合格</th>
                    <th className="px-2 py-2 text-right">不良合计</th>
                    <th className="px-2 py-2 text-right">来料不良-小片</th>
                    <th className="px-2 py-2 text-right">来料不良-带盖</th>
                    <th className="px-2 py-2 text-right">制程不良-小片</th>
                    <th className="px-2 py-2 text-right">制程不良-带盖</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSeq.map((seq) => {
                    const s = opSummary[seq];
                    return (
                      <tr key={seq} className="border-b border-slate-800 text-slate-200">
                        <td className="px-2 py-2 align-top">
                          <div className="font-mono text-xs text-slate-400">#{seq}</div>
                          <div className="text-slate-100">{s.operation_name}</div>
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-100">
                          {formatNumber(s.input_quantity)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-100">
                          {formatNumber(s.pass_quantity)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-amber-400">
                          {formatNumber(s.fail_quantity)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-300">
                          {formatNumber(s.incoming_piece)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-300">
                          {formatNumber(s.incoming_cover)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-300">
                          {formatNumber(s.process_piece)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-mono text-slate-300">
                          {formatNumber(s.process_cover)}
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
                    onChange={(e) => setDefectOpSeq(e.target.value ? Number(e.target.value) : "")}
                    className="h-9 w-full appearance-none rounded border border-slate-700 bg-slate-950 px-2 pr-8 text-sm text-slate-100"
                  >
                    <option value="">-- 请选择工序 --</option>
                    {reportedOps.map((o) => (
                      <option key={o.sequence} value={o.sequence}>
                        #{o.sequence} {o.operation_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                {defectOpSeq !== "" ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>已选：</span>
                    <span className="font-mono text-amber-400">
                      #{defectOpSeq} {currentWoOp?.operation_name ?? ""}
                    </span>
                    <span>· 已登记不良：</span>
                    <span className="font-mono text-amber-300">
                      {formatNumber(currentDefects.reduce((s, d) => s + (d.defect_quantity ?? 0), 0))}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    {reportedOps.length === 0 ? "该工单暂无工序信息" : "请选择一道工序"}
                  </div>
                )}
              </div>

              {/* 新增不良表单 */}
              {!isClosed && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                <select
                  value={newDefect.defect_category}
                  disabled={defectOpSeq === ""}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_category: e.target.value as NewDefect["defect_category"] })}
                  className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 disabled:opacity-50"
                >
                  <option value="制程不良">制程不良</option>
                  <option value="来料不良">来料不良</option>
                  <option value="检验报废">检验报废</option>
                </select>
                <Input
                  placeholder="不良名称"
                  value={newDefect.defect_name}
                  disabled={defectOpSeq === ""}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_name: e.target.value })}
                  className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 disabled:opacity-50"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="数量"
                  value={newDefect.defect_quantity || ""}
                  disabled={defectOpSeq === ""}
                  onChange={(e) => setNewDefect({ ...newDefect, defect_quantity: Number(e.target.value) || 0 })}
                  className="border-slate-700 bg-slate-950 text-right text-slate-100 disabled:opacity-50"
                />
                <select
                  value={newDefect.unit}
                  disabled={defectOpSeq === ""}
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
                  disabled={saving || defectOpSeq === ""}
                >
                  <ListChecks className="mr-1.5 h-4 w-4" /> 新增不良（按工序）
                </Button>
              </div>
              )}

              {/* 不良记录筛选 */}
              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    不良记录 ({filteredDefects.length}/{(detail?.defects ?? []).length})
                  </span>
                  <select
                    value={defectOpSeqFilter}
                    onChange={(e) => setDefectOpSeqFilter(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-7 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                  >
                    <option value="">全部工序</option>
                    {(detail?.work_order_operations ?? []).sort((a, b) => a.sequence - b.sequence).map(op => (
                      <option key={op.id} value={op.sequence}>#{op.sequence} {op.operation_name}</option>
                    ))}
                  </select>
                </div>
                <DefectsTable defects={filteredDefects} onRemove={removeDefect} isClosed={isClosed} />
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
              {/* 新增异常工时表单 */}
              {!isClosed && (
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
              )}
              {/* 异常工时筛选 */}
              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    异常工时记录 ({filteredDowntimes.length}/{(detail?.downtimes ?? []).length})
                  </span>
                  <select
                    value={downtimeTypeFilter}
                    onChange={(e) => setDowntimeTypeFilter(e.target.value)}
                    className="h-7 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                  >
                    <option value="">全部类型</option>
                    <option value="设备故障">设备故障</option>
                    <option value="来料不良">来料不良</option>
                    <option value="其它原因">其它原因</option>
                  </select>
                </div>
                <DowntimesTable rows={filteredDowntimes} onRemove={removeDowntime} isClosed={isClosed} />
              </div>
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
              {/* 新增制程信息表单 */}
              {!isClosed && (
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
                <textarea
                  placeholder="物料标签图片 URL（每行一个）"
                  value={(newPI.material_label_image ?? []).join("\n")}
                  onChange={(e) => setNewPI({ ...newPI, material_label_image: e.target.value.split("\n").filter(Boolean) })}
                  className="md:col-span-2 h-16 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 placeholder:text-slate-600"
                />
                <textarea
                  placeholder="来料不良图片 URL（每行一个）"
                  value={(newPI.incoming_defect_image ?? []).join("\n")}
                  onChange={(e) => setNewPI({ ...newPI, incoming_defect_image: e.target.value.split("\n").filter(Boolean) })}
                  className="h-16 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 placeholder:text-slate-600"
                />
                <textarea
                  placeholder="制程不良图片 URL（每行一个）"
                  value={(newPI.process_defect_image ?? []).join("\n")}
                  onChange={(e) => setNewPI({ ...newPI, process_defect_image: e.target.value.split("\n").filter(Boolean) })}
                  className="h-16 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100 placeholder:text-slate-600"
                />
              </div>
              )}
              {/* 制程信息筛选 */}
              <div className="border-t border-slate-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-500">
                    制程信息记录 ({filteredProcessInfos.length}/{(detail?.process_infos ?? []).length})
                  </span>
                  <select
                    value={processOpSeqFilter}
                    onChange={(e) => setProcessOpSeqFilter(Number(e.target.value) || "")}
                    className="h-7 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
                  >
                    <option value="">全部工序</option>
                    {processes.map((p) => (
                      <option key={p.id} value={Number(p.sequence)}>
                        #{p.sequence} {p.process_name}
                      </option>
                    ))}
                  </select>
                </div>
                <ProcessInfoTable rows={filteredProcessInfos} onRemove={removePI} isClosed={isClosed} />
              </div>
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
          {!isClosed && <th className="px-2 py-2 text-center">操作</th>}
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
            {!isClosed && (
              <td className="px-2 py-1.5 text-center">
                <Button size="sm" variant="ghost" className="h-6 text-rose-400" onClick={() => onRemove(d.id)}>
                  删除
                </Button>
              </td>
            )}
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
          {!isClosed && <th className="px-2 py-2 text-center">操作</th>}
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
            {!isClosed && (
              <td className="px-2 py-1.5 text-center">
                <Button size="sm" variant="ghost" className="h-6 text-rose-400" onClick={() => onRemove(d.id)}>
                  删除
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProcessInfoTable({ rows, onRemove, isClosed }: { rows: ProcessInfo[]; onRemove: (id: string) => void; isClosed: boolean }) {
  const renderImages = (urls: string[] | null | undefined) => {
    if (!urls || urls.length === 0) return "—";
    return urls.map((url, i) => (
      <div key={i} className="truncate max-w-[100px]">
        {url}
      </div>
    ));
  };
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
          {!isClosed && <th className="px-2 py-2 text-center">操作</th>}
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
            <td className="px-2 py-1.5 text-xs text-slate-400">{renderImages(r.material_label_image)}</td>
            <td className="px-2 py-1.5 text-xs text-slate-400">{renderImages(r.incoming_defect_image)}</td>
            <td className="px-2 py-1.5 text-xs text-slate-400">{renderImages(r.process_defect_image)}</td>
            {!isClosed && (
              <td className="px-2 py-1.5 text-center">
                <Button size="sm" variant="ghost" className="h-6 text-rose-400" onClick={() => onRemove(r.id)}>
                  删除
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
