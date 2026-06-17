/**
 * 长沙大满生产管理系统 - 制罐行业业务服务层
 *
 * 涵盖：工单、工序、报工、报检、生产计划、质量日报
 */
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { CAN_PROCESS_NAMES } from "@/lib/constants";
import type {
  WorkOrder,
  WorkOrderOperation,
  WorkOrderReport,
  ProductionLine,
  ProductionPlan,
  QualityInspection,
  DailyQualityReport,
  Product,
  Workshop,
} from "@/types/mes";

const cn = (status: unknown): string => (status == null ? "—" : String(status));

const toWoStatus = (s: string | null | undefined): WorkOrder["status"] => {
  // DB 直接存中文状态（开立/下发/生产中/暂停/完工/超期完工），原样返回
  if (!s) return "开立";
  return s as WorkOrder["status"];
};

const toWoView = (r: Record<string, unknown>): WorkOrder => ({
  id: String(r.id),
  order_no: String(r.order_no),
  sales_order_no: cn(r.sales_order_no),
  product_code: String(r.product_code),
  product_name: cn(r.product_name),
  specification: cn(r.specification),
  quantity: Number(r.quantity ?? r.planned_quantity ?? 0),
  completed_quantity: Number(r.completed_quantity ?? 0),
  scrap_quantity: Number(r.scrap_quantity ?? 0),
  status: toWoStatus(r.status as string | null),
  priority: (Number(r.priority ?? 3) as WorkOrder["priority"]),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  workshop: cn(r.workshop_name),
  workshop_code: cn(r.workshop_code),
  customer_name: cn(r.customer_name),
  order_type: cn(r.order_type),
  unit: cn(r.unit) || "罐",
  planned_start_date: cn(r.planned_start_date),
  planned_end_date: cn(r.planned_end_date),
  actual_start_date: cn(r.actual_start_date),
  actual_end_date: cn(r.actual_end_date),
  notes: cn(r.notes),
  created_at: cn(r.created_at),
  updated_at: cn(r.updated_at),
});

const toOpView = (r: Record<string, unknown>): WorkOrderOperation => ({
  id: String(r.id),
  work_order_id: String(r.work_order_id),
  sequence: Number(r.sequence ?? 0),
  operation_code: cn(r.operation_code),
  operation_name: cn(r.operation_name),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  standard_time_minutes: Number(r.standard_time_minutes ?? 0),
  status: (r.status as WorkOrderOperation["status"]) ?? "pending",
  operator_name: cn(r.operator_name),
  good_quantity: Number(r.good_quantity ?? 0),
  scrap_quantity: Number(r.scrap_quantity ?? 0),
  start_time: cn(r.start_time),
  end_time: cn(r.end_time),
  notes: cn(r.notes),
});

const toReportView = (r: Record<string, unknown>): WorkOrderReport => ({
  id: String(r.id),
  work_order_id: String(r.work_order_id),
  work_order_no: cn(r.work_order_no),
  operation_id: cn(r.operation_id),
  process_name: cn(r.process_name),
  operator_name: cn(r.operator_name),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  shift_no: cn(r.shift_no) || "白班",
  report_type: cn(r.report_type),
  good_quantity: Number(r.good_quantity ?? 0),
  scrap_quantity: Number(r.scrap_quantity ?? 0),
  scrap_reason: cn(r.scrap_reason),
  product_code: cn(r.product_code),
  product_name: cn(r.product_name),
  can_spec: cn(r.can_spec),
  can_height: Number(r.can_height ?? 0),
  batch_no: cn(r.batch_no),
  inspector_name: cn(r.inspector_name),
  reported_at: cn(r.reported_at),
  notes: cn(r.notes),
});

const toLineView = (r: Record<string, unknown>): ProductionLine => ({
  id: String(r.id),
  code: String(r.code),
  name: String(r.name),
  workshop_code: cn(r.workshop_code),
  workshop_name: cn(r.workshop_name),
  status: cn(r.status) || "运行",
  description: cn(r.description),
});

const toPlanView = (r: Record<string, unknown>): ProductionPlan => ({
  id: String(r.id),
  plan_date: cn(r.plan_date),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  work_order_id: String(r.work_order_id),
  work_order_no: cn(r.work_order_no),
  product_code: cn(r.product_code),
  product_name: cn(r.product_name),
  planned_quantity: Number(r.planned_quantity ?? 0),
  priority: Number(r.priority ?? 3),
  status: cn(r.status) || "已排",
  notes: cn(r.notes),
  created_at: cn(r.created_at),
  updated_at: cn(r.updated_at),
});

const toInspectionView = (r: Record<string, unknown>): QualityInspection => ({
  id: String(r.id),
  inspection_no: cn(r.inspection_no),
  work_order_id: cn(r.work_order_id),
  work_order_no: cn(r.work_order_no),
  inspection_type: cn(r.inspection_type),
  product_code: cn(r.product_code),
  product_name: cn(r.product_name),
  batch_no: cn(r.batch_no),
  inspector_name: cn(r.inspector_name),
  inspection_time: cn(r.inspection_time),
  sample_size: Number(r.sample_size ?? 0),
  pass_quantity: Number(r.pass_quantity ?? 0),
  fail_quantity: Number(r.fail_quantity ?? 0),
  result: cn(r.result),
  defect_code: cn(r.defect_code),
  defect_name: cn(r.defect_name),
  defect_description: cn(r.defect_description),
  process_name: cn(r.process_name),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  shift_no: cn(r.shift_no) || "白班",
  can_spec: cn(r.can_spec),
  can_height: Number(r.can_height ?? 0),
  notes: cn(r.notes),
});

const toDailyView = (r: Record<string, unknown>): DailyQualityReport => ({
  id: String(r.id),
  report_date: cn(r.report_date),
  line_code: cn(r.line_code),
  line_name: cn(r.line_name),
  process_name: cn(r.process_name),
  product_code: cn(r.product_code),
  product_name: cn(r.product_name),
  can_spec: cn(r.can_spec),
  can_height: Number(r.can_height ?? 0),
  shift_no: cn(r.shift_no) || "白班",
  total_inspected: Number(r.total_inspected ?? 0),
  total_good: Number(r.total_good ?? 0),
  total_scrap: Number(r.total_scrap ?? 0),
  pass_rate: Number(r.pass_rate ?? 0),
  scrap_rate: Number(r.scrap_rate ?? 0),
  defect_breakdown: r.defect_breakdown,
});

const toProductView = (r: Record<string, unknown>): Product => ({
  id: String(r.id),
  code: String(r.code),
  name: String(r.name),
  specification: cn(r.specification),
  unit: cn(r.unit) || "罐",
  process_route: cn(r.process_route),
  customer_name: cn(r.customer_name),
  default_line_code: cn(r.default_line_code),
  default_line_name: cn(r.default_line_name),
});

const toWorkshopView = (r: Record<string, unknown>): Workshop => ({
  id: String(r.id),
  code: String(r.code),
  name: String(r.name),
  description: cn(r.description),
});

// ==================== 工单 ====================

export async function listWorkOrders(opts?: {
  status?: string | string[];
  statuses?: string[];
  line?: string;
  keyword?: string;
  limit?: number;
}): Promise<WorkOrder[]> {
  const c = getSupabaseClient();
  let q = c.from("work_orders").select("*").order("created_at", { ascending: false });
  const statusList = opts?.statuses ?? (opts?.status ? [opts.status] : undefined);
  if (statusList && statusList.length > 0) {
    // 兼容历史英文 status：自动展开为中英文并集
    const EN_TO_CN: Record<string, string> = {
      planned: "开立",
      released: "下发",
      in_progress: "生产中",
      paused: "暂停",
      completed: "完工",
      closed: "超期完工",
    };
    const expanded = new Set<string>();
    const inputs: string[] = Array.isArray(statusList)
      ? (statusList as string[])
      : statusList
        ? [statusList as string]
        : [];
    for (const s of inputs) {
      expanded.add(s);
      if (EN_TO_CN[s]) expanded.add(EN_TO_CN[s]);
      const en = Object.keys(EN_TO_CN).find((k) => EN_TO_CN[k] === s);
      if (en) expanded.add(en);
    }
    q = q.in("status", Array.from(expanded));
  }
  if (opts?.line) q = q.eq("line_code", opts.line);
  if (opts?.keyword) q = q.ilike("order_no", `%${opts.keyword}%`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []).map(toWoView);
}

export interface CreateWorkOrderInput {
  order_no?: string;        // 不传则自动生成 MO-YYYYMMDDHHmm-XXX
  product_code: string;
  product_name?: string;
  specification?: string;
  planned_quantity: number;
  line_code: string;
  line_name?: string;
  priority?: number;        // 1-5, 数字越小越高
  order_type?: string;      // 默认 "制罐生产订单"
  customer_name?: string;
  sales_order_no?: string;
  planned_start_date?: string;  // ISO
  planned_end_date?: string;
  notes?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** MO 号格式：MO-16 + YY + MM + DD + NNN(三位流水)
 *  例：MO-16260617003
 *  流水号按当天最大流水 + 1 续号（找不到时从 001 开始） */
function orderNoPrefix(): string {
  const d = new Date();
  return `MO-16${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

async function nextOrderNo(): Promise<string> {
  const prefix = orderNoPrefix();
  const c = getSupabaseClient();
  const { data } = await c
    .from("work_orders")
    .select("order_no")
    .like("order_no", `${prefix}%`)
    .order("order_no", { ascending: false })
    .limit(1);
  let maxSeq = 0;
  if (data && data.length > 0) {
    const last = String((data[0] as { order_no: string }).order_no);
    const tail = last.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) maxSeq = n;
  }
  return `${prefix}${pad3(maxSeq + 1)}`;
}

export async function generateOrderNo(): Promise<string> {
  return nextOrderNo();
}

export async function createWorkOrder(input: CreateWorkOrderInput) {
  const c = getSupabaseClient();
  // 校验产品
  const { data: prod, error: pErr } = await c
    .from("products")
    .select("code, name, specification, unit, default_line_code, default_line_name")
    .eq("code", input.product_code)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!prod) {
    const err: Error & { status?: number } = new Error(
      `物料 ${input.product_code} 不存在，请先在物料字典创建`
    );
    err.status = 400;
    throw err;
  }

  // 返工订单默认原产线（如果入参未传 line_code）
  let lineCode = input.line_code;
  let lineName = input.line_name;
  if (!lineCode) {
    const fallbackLine = (prod as { default_line_code?: string | null }).default_line_code;
    if (!fallbackLine) {
      const err: Error & { status?: number } = new Error(
        `物料 ${input.product_code} 未设置默认产线，请在参数设置中配置后重试`
      );
      err.status = 400;
      throw err;
    }
    lineCode = fallbackLine;
    const _lineNameFromProd = (prod as { default_line_name?: string | null }).default_line_name;
    lineName = _lineNameFromProd ?? undefined;
  }

  // 校验产线
  const { data: line, error: lErr } = await c
    .from("production_lines")
    .select("code, name, workshop_code, workshop_name")
    .eq("code", lineCode)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!line) {
    const err: Error & { status?: number } = new Error(`产线 ${lineCode} 不存在`);
    err.status = 400;
    throw err;
  }

  // MO 号：用户输入则校验格式 + 查重；空则按 MO-16YYMMDDNNN 自动续号
  // 格式：MO-16(2位年)(2位月)(2位日)(3位流水) = MO-16 + 9 位数字
  const userOrderNo = input.order_no?.trim();
  if (userOrderNo) {
    if (!/^MO-16\d{9}$/.test(userOrderNo)) {
      const err: Error & { status?: number } = new Error(
        "MO 号格式应为 MO-16+两位年+两位月+两位日+三位流水，如 MO-16260617003"
      );
      err.status = 400;
      throw err;
    }
    const { data: dup } = await c
      .from("work_orders")
      .select("id")
      .eq("order_no", userOrderNo)
      .maybeSingle();
    if (dup) {
      const err: Error & { status?: number } = new Error(`MO 号 ${userOrderNo} 已存在`);
      err.status = 409;
      throw err;
    }
  }
  const orderNo = userOrderNo || (await nextOrderNo());
  const priority = Math.max(1, Math.min(5, input.priority ?? 3));
  // 注意：lineName 可能为空字符串，需用 || 兜底，?? 不会因为空字符串触发
  const finalLineName = lineName || (line as { name: string }).name;
  const ws = line as { workshop_code: string; workshop_name: string };
  const productName = input.product_name?.trim() || (prod as { name: string }).name;
  const productSpec = input.specification ?? (prod as { specification?: string | null }).specification ?? null;

  const { data, error } = await c
    .from("work_orders")
    .insert({
      order_no: orderNo,
      order_type: input.order_type ?? "制罐生产订单",
      sales_order_no: input.sales_order_no ?? null,
      product_code: input.product_code,
      product_name: productName,
      specification: productSpec,
      unit: (prod as { unit?: string | null }).unit ?? "罐",
      planned_quantity: input.planned_quantity,
      completed_quantity: 0,
      scrap_quantity: 0,
      status: "开立",
      priority,
      workshop_code: ws.workshop_code,
      workshop_name: ws.workshop_name,
      line_code: lineCode,
      line_name: finalLineName,
      customer_name: input.customer_name ?? null,
      planned_start_date: input.planned_start_date ?? new Date().toISOString(),
      planned_end_date: input.planned_end_date ?? new Date(Date.now() + 86400000 * 3).toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // 自动生成 13 道工序
  const ops = CAN_PROCESS_NAMES.map((name, idx) => ({
    work_order_id: (data as { id: string }).id,
    sequence: idx + 1,
    operation_name: name,
    workstation: finalLineName === "A线" ? "A线主控台" : "B线主控台",
    line_code: lineCode,
    line_name: finalLineName,
    standard_time_minutes: Math.max(30, Math.round(input.planned_quantity / 500)),
    status: "pending",
    good_quantity: 0,
    scrap_quantity: 0,
  }));
  await c.from("work_order_operations").insert(ops);

  // 注意：新工单状态默认为 planned（未下发），不再自动建排产。
  // 用户在工单管理中点击"下发"后，再到七天计划页面拖入排程。
  // 如需保留自动排产的行为（兼容老调用方），调用方可在外部显式 addPlan。

  return toWoView(data as Record<string, unknown>);
}

export async function getWorkOrder(id: string) {
  const c = getSupabaseClient();
  const { data: wo, error } = await c
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!wo) return null;

  const { data: ops } = await c
    .from("work_order_operations")
    .select("*")
    .eq("work_order_id", id)
    .order("sequence", { ascending: true });

  const { data: reps } = await c
    .from("work_order_reports")
    .select("*")
    .eq("work_order_id", id)
    .order("reported_at", { ascending: false })
    .limit(50);

  return {
    workOrder: toWoView(wo as Record<string, unknown>),
    operations: (ops ?? []).map(toOpView),
    reports: (reps ?? []).map(toReportView),
  };
}

export async function updateWorkOrderDates(
  id: string,
  patch: { planned_start_date?: string; planned_end_date?: string }
) {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("work_orders")
    .update({
      planned_start_date: patch.planned_start_date,
      planned_end_date: patch.planned_end_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toWoView(data as Record<string, unknown>);
}

export async function updateWorkOrderStatus(id: string, status: string) {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("work_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toWoView(data as Record<string, unknown>);
}

// ==================== 报工（13 工序） ====================

export interface CreateReportInput {
  work_order_id: string;
  operation_id?: string;
  process_name: string;
  operator_name: string;
  line_code: string;
  line_name?: string;
  shift_no: string;
  good_quantity: number;
  scrap_quantity: number;
  batch_no: string;
  inspector_name?: string;
  can_spec?: string;
  can_height?: number;
  notes?: string;
  inspection_type?: string;
}

export async function createReport(input: CreateReportInput) {
  const c = getSupabaseClient();
  const { data: wo } = await c
    .from("work_orders")
    .select("order_no, product_code, product_name")
    .eq("id", input.work_order_id)
    .maybeSingle();
  if (!wo) throw new Error("工单不存在");

  const lineName = input.line_name ?? (input.line_code === "LINE-A" ? "A线" : "B线");
  const total = input.good_quantity + input.scrap_quantity;

  // 1) 写入报工记录
  const { data: report, error: rerr } = await c
    .from("work_order_reports")
    .insert({
      work_order_id: input.work_order_id,
      work_order_no: (wo as { order_no: string }).order_no,
      operation_id: input.operation_id ?? null,
      process_name: input.process_name,
      operator_name: input.operator_name,
      line_code: input.line_code,
      line_name: lineName,
      shift_no: input.shift_no,
      report_type: "production",
      good_quantity: input.good_quantity,
      scrap_quantity: input.scrap_quantity,
      product_code: (wo as { product_code: string }).product_code,
      product_name: (wo as { product_name: string }).product_name,
      can_spec: input.can_spec ?? null,
      can_height: input.can_height ?? null,
      batch_no: input.batch_no ?? null,
      inspector_name: input.inspector_name ?? input.operator_name,
      reported_at: new Date().toISOString(),
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (rerr) throw rerr;

  // 2) 更新对应工序的累计
  if (input.operation_id) {
    await c
      .from("work_order_operations")
      .update({
        good_quantity: input.good_quantity, // 简化：本工序最近一次报工量
        scrap_quantity: input.scrap_quantity,
        end_time: new Date().toISOString(),
      })
      .eq("id", input.operation_id);
  }

  // 3) 累加工单的累计
  const { data: currentWo } = await c
    .from("work_orders")
    .select("completed_quantity, scrap_quantity, status")
    .eq("id", input.work_order_id)
    .single();
  if (currentWo) {
    const newCompleted = Number(currentWo.completed_quantity ?? 0) + input.good_quantity;
    const newScrap = Number(currentWo.scrap_quantity ?? 0) + input.scrap_quantity;
    const newStatus =
      currentWo.status === "开立" || currentWo.status === "已下发" ? "开工" : currentWo.status;
    await c
      .from("work_orders")
      .update({
        completed_quantity: newCompleted,
        scrap_quantity: newScrap,
        actual_start_date:
          currentWo.status === "开立" || currentWo.status === "已下发"
            ? new Date().toISOString()
            : undefined,
        status: newStatus,
      })
      .eq("id", input.work_order_id);
  }

  // 4) 实时聚合：当天/产线/工序/产品的累计（用于日报）
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await c
    .from("daily_quality_reports")
    .select("*")
    .eq("report_date", today)
    .eq("line_code", input.line_code)
    .eq("process_name", input.process_name)
    .eq("product_code", (wo as { product_code: string }).product_code)
    .eq("shift_no", input.shift_no)
    .maybeSingle();

  const inspected = total;
  const good = input.good_quantity;
  const scrap = input.scrap_quantity;
  const passRate = inspected > 0 ? good / inspected : 0;
  const scrapRate = inspected > 0 ? scrap / inspected : 0;

  if (existing) {
    const e = existing as Record<string, unknown>;
    const newInspected = Number(e.total_inspected ?? 0) + inspected;
    const newGood = Number(e.total_good ?? 0) + good;
    const newScrap = Number(e.total_scrap ?? 0) + scrap;
    await c
      .from("daily_quality_reports")
      .update({
        total_inspected: newInspected,
        total_good: newGood,
        total_scrap: newScrap,
        pass_rate: newGood / Math.max(newInspected, 1),
        scrap_rate: newScrap / Math.max(newInspected, 1),
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(e.id));
  } else {
    await c.from("daily_quality_reports").insert({
      report_date: today,
      line_code: input.line_code,
      line_name: lineName,
      process_name: input.process_name,
      product_code: (wo as { product_code: string }).product_code,
      product_name: (wo as { product_name: string }).product_name,
      can_spec: input.can_spec ?? null,
      can_height: input.can_height ?? null,
      shift_no: input.shift_no,
      total_inspected: inspected,
      total_good: good,
      total_scrap: scrap,
      pass_rate: passRate,
      scrap_rate: scrapRate,
    });
  }

  return toReportView(report as Record<string, unknown>);
}

// ==================== 报检（生成 quality_inspections 记录） ====================

export interface CreateInspectionInput {
  work_order_id: string;
  work_order_no: string;
  inspection_type: string; // first / in_process / final
  process_name: string;
  product_code: string;
  product_name: string;
  batch_no: string;
  inspector_name: string;
  sample_size: number;
  result: "pass" | "fail" | "conditional";
  defect_code?: string;
  defect_name?: string;
  defect_description?: string;
  line_code: string;
  shift_no: string;
  can_spec?: string;
  can_height?: number;
  notes?: string;
}

export async function createInspection(input: CreateInspectionInput) {
  const c = getSupabaseClient();
  const inspectionNo = `QI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const lineName = input.line_code === "LINE-A" ? "A线" : "B线";
  const { data, error } = await c
    .from("quality_inspections")
    .insert({
      inspection_no: inspectionNo,
      work_order_id: input.work_order_id,
      work_order_no: input.work_order_no,
      inspection_type: input.inspection_type,
      process_name: input.process_name,
      product_code: input.product_code,
      product_name: input.product_name,
      batch_no: input.batch_no,
      inspector_name: input.inspector_name,
      inspection_time: new Date().toISOString(),
      sample_size: input.sample_size,
      result: input.result,
      defect_code: input.defect_code ?? null,
      defect_name: input.defect_name ?? null,
      defect_description: input.defect_description ?? null,
      line_code: input.line_code,
      line_name: lineName,
      shift_no: input.shift_no,
      can_spec: input.can_spec ?? null,
      can_height: input.can_height ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toInspectionView(data as Record<string, unknown>);
}

// ==================== 产线 ====================

export async function listProductionLines(): Promise<ProductionLine[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("production_lines")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toLineView);
}

// ==================== 七天滚动计划 ====================

export interface PlanFilter {
  start_date?: string;
  end_date?: string;
  line_code?: string;
}

export async function listPlans(filter: PlanFilter = {}): Promise<ProductionPlan[]> {
  const c = getSupabaseClient();
  let q = c.from("production_plans").select("*").order("plan_date", { ascending: true });
  if (filter.start_date) q = q.gte("plan_date", filter.start_date);
  if (filter.end_date) q = q.lte("plan_date", filter.end_date);
  if (filter.line_code) q = q.eq("line_code", filter.line_code);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  return (data ?? []).map(toPlanView);
}

export async function updatePlan(
  id: string,
  patch: { plan_date?: string; line_code?: string; priority?: number; status?: string; notes?: string; planned_quantity?: number }
) {
  const c = getSupabaseClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.plan_date !== undefined) update.plan_date = patch.plan_date;
  if (patch.line_code !== undefined) {
    update.line_code = patch.line_code;
    update.line_name = patch.line_code === "LINE-A" ? "A线" : "B线";
  }
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.planned_quantity !== undefined) update.planned_quantity = patch.planned_quantity;
  const { data, error } = await c
    .from("production_plans")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toPlanView(data as Record<string, unknown>);
}

export async function deletePlan(id: string) {
  const c = getSupabaseClient();
  const { error } = await c.from("production_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function addPlan(input: Omit<ProductionPlan, "id" | "created_at" | "updated_at">) {
  const c = getSupabaseClient();
  const { data, error } = await c.from("production_plans").insert(input).select().single();
  if (error) throw error;
  return toPlanView(data as Record<string, unknown>);
}

// ==================== 检验记录 ====================

export async function listInspections(opts?: {
  limit?: number;
  result?: string;
  from?: string;
  to?: string;
  lineCode?: string;
  processName?: string;
}) {
  const c = getSupabaseClient();
  let q = c
    .from("quality_inspections")
    .select("*")
    .order("inspection_time", { ascending: false });
  if (opts?.result) q = q.eq("result", opts.result);
  if (opts?.from) q = q.gte("inspection_time", opts.from);
  if (opts?.to) q = q.lte("inspection_time", opts.to);
  if (opts?.lineCode) q = q.eq("line_code", opts.lineCode);
  if (opts?.processName) q = q.eq("process_name", opts.processName);
  const { data, error } = await q.limit(opts?.limit ?? 200);
  if (error) throw error;
  return (data ?? []).map(toInspectionView);
}

// ==================== 质量日报 ====================

export async function listDailyReports(opts?: {
  start_date?: string;
  end_date?: string;
  line_code?: string;
  process_name?: string;
}): Promise<DailyQualityReport[]> {
  const c = getSupabaseClient();
  let q = c
    .from("daily_quality_reports")
    .select("*")
    .order("report_date", { ascending: false });
  if (opts?.start_date) q = q.gte("report_date", opts.start_date);
  if (opts?.end_date) q = q.lte("report_date", opts.end_date);
  if (opts?.line_code) q = q.eq("line_code", opts.line_code);
  if (opts?.process_name) q = q.eq("process_name", opts.process_name);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  return (data ?? []).map(toDailyView);
}

export async function listDefectCodes() {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("defect_codes")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ==================== 产品 ====================

export async function listProducts(): Promise<Product[]> {
  const c = getSupabaseClient();
  const { data, error } = await c.from("products").select("*").order("code", { ascending: true }).limit(500);
  if (error) throw error;
  return (data ?? []).map(toProductView);
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  specification?: string | null;
  unit?: string | null;
  process_route?: string | null;
  default_line_code?: string | null;
  default_line_name?: string | null;
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  const c = getSupabaseClient();
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.specification !== undefined) updates.specification = input.specification;
  if (input.unit !== undefined) updates.unit = input.unit;
  if (input.process_route !== undefined) updates.process_route = input.process_route;
  if (input.default_line_code !== undefined) updates.default_line_code = input.default_line_code;
  if (input.default_line_name !== undefined) updates.default_line_name = input.default_line_name;

  const { data, error } = await c
    .from("products")
    .update(updates)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return toProductView(data as Record<string, unknown>);
}

// ==================== 车间 ====================

export async function listWorkshops(): Promise<Workshop[]> {
  const c = getSupabaseClient();
  const { data, error } = await c.from("workshops").select("*").order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toWorkshopView);
}

// ==================== 看板 ====================

export async function getDashboardSummary() {
  const c = getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  // 今日报工
  const { data: todayReports } = await c
    .from("work_order_reports")
    .select("good_quantity, scrap_quantity, line_code, process_name")
    .gte("reported_at", `${today}T00:00:00`)
    .lte("reported_at", `${today}T23:59:59`);

  const todayGood = (todayReports ?? []).reduce((s, r) => s + Number(r.good_quantity ?? 0), 0);
  const todayScrap = (todayReports ?? []).reduce((s, r) => s + Number(r.scrap_quantity ?? 0), 0);
  const todayTotal = todayGood + todayScrap;

  // 计划（接下来 7 天）
  const { data: plans } = await c
    .from("production_plans")
    .select("planned_quantity")
    .gte("plan_date", today)
    .lte("plan_date", dateAdd(today, 6));
  const plannedQty = (plans ?? []).reduce((s, p) => s + Number(p.planned_quantity ?? 0), 0);
  const completionRate = plannedQty > 0 ? (todayGood / plannedQty) * 100 : 0;

  // 产线状态
  const { data: lines } = await c.from("production_lines").select("*");
  const lineMap: Record<string, { total: number; running: number; idle: number; maint: number }> = {};
  for (const ln of lines ?? []) {
    lineMap[String(ln.code)] = { total: 0, running: 0, idle: 0, maint: 0 };
  }
  for (const r of todayReports ?? []) {
    const k = String(r.line_code);
    if (!lineMap[k]) lineMap[k] = { total: 0, running: 0, idle: 0, maint: 0 };
    lineMap[k].total += Number(r.good_quantity ?? 0) + Number(r.scrap_quantity ?? 0);
    if (Number(r.good_quantity ?? 0) > 0) lineMap[k].running += 1;
  }
  // 每个产线 if 今天有报工 = 运行, else = 待机
  for (const k of Object.keys(lineMap)) {
    lineMap[k].running = lineMap[k].total > 0 ? 1 : 0;
    lineMap[k].idle = lineMap[k].total > 0 ? 0 : 1;
  }

  // 质量（最近 7 天日报聚合）
  const { data: recentReports } = await c
    .from("daily_quality_reports")
    .select("total_inspected, total_good, total_scrap, line_code, process_name")
    .gte("report_date", dateAdd(today, -6))
    .lte("report_date", today);
  const sumInspected = (recentReports ?? []).reduce((s, r) => s + Number(r.total_inspected ?? 0), 0);
  const sumGood = (recentReports ?? []).reduce((s, r) => s + Number(r.total_good ?? 0), 0);
  const sumScrap = (recentReports ?? []).reduce((s, r) => s + Number(r.total_scrap ?? 0), 0);
  const firstPassRate = sumInspected > 0 ? (sumGood / sumInspected) * 100 : 0;
  const defectRate = sumInspected > 0 ? (sumScrap / sumInspected) * 100 : 0;

  // 7 日趋势
  const trend: Array<{ date: string; planned: number; actual: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = dateAdd(today, -i);
    const { data: dayReports } = await c
      .from("work_order_reports")
      .select("good_quantity")
      .gte("reported_at", `${d}T00:00:00`)
      .lte("reported_at", `${d}T23:59:59`);
    const actual = (dayReports ?? []).reduce((s, r) => s + Number(r.good_quantity ?? 0), 0);
    const { data: dayPlans } = await c
      .from("production_plans")
      .select("planned_quantity")
      .eq("plan_date", d);
    const planned = (dayPlans ?? []).reduce((s, p) => s + Number(p.planned_quantity ?? 0), 0);
    trend.push({ date: d.slice(5).replace("-", "-"), planned, actual });
  }

  // 在制工单
  const { data: activeWOs } = await c
    .from("work_orders")
    .select("*")
    .in("status", ["开立", "已下发", "开工", "已暂停"])
    .order("priority", { ascending: true })
    .limit(10);

  return {
    today: {
      plannedQty,
      completedQty: todayGood,
      scrapQty: todayScrap,
      completionRate,
    },
    lines: Object.entries(lineMap).map(([code, v]) => ({
      code,
      name: code === "LINE-A" ? "A线" : "B线",
      status: v.running > 0 ? "running" : "idle",
      output: v.total,
    })),
    quality: {
      firstPassRate,
      inspectionCount: sumInspected,
      defectCount: sumScrap,
      defectRate,
    },
    outputTrend: trend,
    activeWorkOrders: (activeWOs ?? []).map(toWoView),
  };
}

function dateAdd(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export { CAN_PROCESS_NAMES };

export interface CreateProductInput {
  code: string;
  name: string;
  specification?: string | null;
  unit?: string | null;
  process_route?: string | null;
  default_line_code?: string | null;
  default_line_name?: string | null;
}

export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  const code = (input.code ?? "").trim();
  if (!code) throw new Error("料号不能为空");
  if (!input.name?.trim()) throw new Error("产品名称不能为空");
  const supa = getSupabaseClient();
  // 料号唯一
  const { data: exist } = await supa
    .from("products")
    .select("id, code")
    .eq("code", code)
    .maybeSingle();
  if (exist) {
    throw new Error(`料号「${code}」已存在`);
  }
  let lineName = input.default_line_name ?? null;
  if (input.default_line_code && !lineName) {
    const { data: ln } = await supa
      .from("production_lines")
      .select("name")
      .eq("code", input.default_line_code)
      .maybeSingle();
    lineName = (ln as { name?: string } | null)?.name ?? input.default_line_code;
  }
  const row = {
    code,
    name: input.name.trim(),
    specification: input.specification ?? null,
    unit: input.unit ?? "罐",
    process_route: input.process_route ?? null,
    default_line_code: input.default_line_code ?? null,
    default_line_name: lineName,
  };
  const { data, error } = await supa
    .from("products")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`创建产品失败：${error.message}`);
  return data as Product;
}

export interface ImportProductsResult {
  total: number;
  inserted: number;
  skippedDuplicates: number;
  errors: { row: number; reason: string; code?: string }[];
}

/**
 * 批量导入产品；按料号去重（已存在则跳过）
 */
export async function importProducts(
  rows: CreateProductInput[]
): Promise<ImportProductsResult> {
  const supa = getSupabaseClient();
  const result: ImportProductsResult = {
    total: rows.length,
    inserted: 0,
    skippedDuplicates: 0,
    errors: [],
  };
  if (rows.length === 0) return result;

  // 1) 行内去重 + 校验
  const seenInBatch = new Set<string>();
  const validRows: CreateProductInput[] = [];
  rows.forEach((r, idx) => {
    const code = (r.code ?? "").trim();
    if (!code) {
      result.errors.push({ row: idx + 1, reason: "料号为空" });
      return;
    }
    if (!r.name?.trim()) {
      result.errors.push({ row: idx + 1, reason: "产品名称为空", code });
      return;
    }
    if (seenInBatch.has(code)) {
      result.skippedDuplicates++;
      return;
    }
    seenInBatch.add(code);
    validRows.push({ ...r, code });
  });

  // 2) DB 料号去重
  const codes = Array.from(seenInBatch);
  const { data: existing } = await supa
    .from("products")
    .select("code")
    .in("code", codes);
  const existSet = new Set((existing ?? []).map((e) => (e as { code: string }).code));
  const toInsert = validRows.filter((r) => !existSet.has(r.code));

  result.skippedDuplicates += validRows.length - toInsert.length;

  // 3) 解析产线 name
  const lineCodeSet = Array.from(
    new Set(toInsert.map((r) => r.default_line_code).filter((x): x is string => !!x))
  );
  const lineMap = new Map<string, string>();
  if (lineCodeSet.length > 0) {
    const { data: lns } = await supa
      .from("production_lines")
      .select("code, name")
      .in("code", lineCodeSet);
    for (const l of lns ?? []) {
      lineMap.set((l as { code: string }).code, (l as { code: string; name: string }).name);
    }
  }
  const payload = toInsert.map((r) => ({
    code: r.code,
    name: r.name!.trim(),
    specification: r.specification ?? null,
    unit: r.unit ?? "罐",
    process_route: r.process_route ?? null,
    default_line_code: r.default_line_code ?? null,
    default_line_name: r.default_line_code ? (lineMap.get(r.default_line_code) ?? r.default_line_code) : null,
  }));

  // 4) 分批插入
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { error } = await supa.from("products").insert(chunk);
    if (error) {
      chunk.forEach((c) =>
        result.errors.push({ row: -1, reason: error.message, code: c.code })
      );
    } else {
      result.inserted += chunk.length;
    }
  }
  return result;
}
