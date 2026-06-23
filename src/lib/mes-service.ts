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
  OperationReport,
  ProductionLine,
  ProductionPlan,
  QualityInspection,
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

  const { data: woReports } = await c
    .from("work_order_reports")
    .select("*")
    .eq("work_order_id", id)
    .order("start_at", { ascending: false })
    .limit(50);

  const woReportIds = (woReports ?? []).map((r) => r.id);
  let opReports: any[] = [];
  if (woReportIds.length) {
    const { data: ors } = await c
      .from("operation_reports")
      .select("*")
      .in("work_order_report_id", woReportIds)
      .order("sequence", { ascending: true });
    opReports = ors ?? [];
  }

  return {
    workOrder: toWoView(wo as Record<string, unknown>),
    operations: (ops ?? []).map(toOpView),
    workOrderReports: (woReports ?? []).map(toWorkOrderReportView),
    operationReports: opReports.map(toOperationReportView),
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

// ==================== 两级报工（工单报工 + 工序报工） ====================
//
// 适配层：UI 仍消费旧 WorkOrderReport / OperationReport 形状（含 change_line_at/cleanup_minutes/
// material_code/input_qty/defect_qty/work_order_report_id 等旧字段），但底层数据来自新表
// work_order_reports / operation_reports / operation_defects / equipment_downtime（按
// work_order_no + batch_no + finish_seq 三元组关联）。

// 旧表 work_order_reports 已被新表替代。所有函数读 work_order_reports 新表。
// 旧字段兼容映射：
//   work_order_id      -> work_order_no
//   change_line_at     -> null（新表无此字段）
//   cleanup_minutes    -> 0
//   其他字段含义保持一致
const toWorkOrderReportView = (r: Record<string, unknown>): WorkOrderReport => {
  const start = cn(r.start_at);
  const workOrderNo = cn(r.work_order_no);
  const batchNo = cn(r.batch_no);
  const finishSeq = Number(r.finish_seq ?? 0);
  const worId = workOrderNo && batchNo ? `${workOrderNo}-${batchNo}-${finishSeq}` : cn(r.id);
  return {
    id: cn(r.id),
    work_order_no: workOrderNo,
    work_order_id: workOrderNo,
    batch_no: batchNo,
    finish_seq: finishSeq,
    start_at: start,
    change_line_at: null,
    end_at: r.end_at ? cn(r.end_at) : null,
    skilled_workers: Number(r.skilled_workers ?? 0),
    general_workers: Number(r.general_workers ?? 0),
    labor_workers: Number(r.labor_workers ?? 0),
    cleanup_minutes: 0,
    other_workers: Number(r.other_workers ?? 0),
    abnormal_minutes: Number(r.abnormal_minutes ?? 0),
    man_hours: Number(r.man_hours ?? 0),
    fill_time: cn(r.fill_time),
    status: (cn(r.status) || "活跃") as WorkOrderReport["status"],
    notes: cn(r.notes),
    created_at: cn(r.created_at),
    updated_at: cn(r.updated_at),
    closed_at: r.closed_at ? cn(r.closed_at) : null,
  };
  // 备注:worId 已合并到 id 字段中以便 UI 用 id 关联工序报工
  void worId;
};

const toOperationReportView = (r: Record<string, unknown>): OperationReport => {
  const workOrderNo = cn(r.work_order_no);
  const batchNo = cn(r.batch_no);
  const finishSeq = Number(r.finish_seq ?? 0);
  const processCode = cn(r.process_code);
  const quantity = r.quantity == null ? null : Number(r.quantity);
  const incomingTotal = Number(r.incoming_defect_total ?? 0);
  const processTotal = Number(r.process_defect_total ?? 0);
  const defectQty = incomingTotal + processTotal;
  return {
    id: cn(r.id),
    work_order_no: workOrderNo,
    work_order_id: workOrderNo,
    batch_no: batchNo,
    finish_seq: finishSeq,
    work_order_report_id: cn(r.work_order_no) && cn(r.batch_no) ? `${workOrderNo}-${batchNo}-${finishSeq}` : cn(r.id),
    process_code: processCode,
    process_name: cn(r.process_name),
    operation_id: processCode,
    sequence: Number(r.sequence ?? 0),
    material_code: "",
    material_name: cn(r.process_name),
    material_batch_no: "",
    quantity,
    input_qty: quantity ?? 0,
    incoming_defect_piece: Number(r.incoming_defect_piece ?? 0),
    incoming_defect_lid: Number(r.incoming_defect_lid ?? 0),
    process_defect_piece: Number(r.process_defect_piece ?? 0),
    process_defect_lid: Number(r.process_defect_lid ?? 0),
    incoming_defect_total: incomingTotal,
    process_defect_total: processTotal,
    defect_qty: defectQty,
    qualified_qty: Number(r.qualified_qty ?? 0),
    notes: "",
    created_at: cn(r.created_at),
    updated_at: cn(r.updated_at),
  };
};

// 通过 work_order_report_id（旧 UI 拼接的 `${workOrderNo}-${batchNo}-${finishSeq}`）解析出三元组
function parseWorId(worId: string): { workOrderNo: string; batchNo: string; finishSeq: number } | null {
  const m = worId.match(/^(.+)-(.+)-(\d+)$/);
  if (!m) return null;
  return { workOrderNo: m[1], batchNo: m[2], finishSeq: Number(m[3]) };
}

export interface CreateWorkOrderReportInput {
  work_order_id: string;       // 旧字段：实际是 work_order_no
  batch_no: string;
  start_at: string;
  change_line_at?: string | null;
  skilled_workers: number;
  general_workers: number;
  labor_workers: number;
  cleanup_minutes: number;
  notes?: string;
}

export async function createWorkOrderReport(input: CreateWorkOrderReportInput) {
  const c = getSupabaseClient();
  const workOrderNo = input.work_order_id;
  // 校验工单
  const { data: wo, error: werr } = await c
    .from("work_orders")
    .select("id, status, order_no")
    .eq("order_no", workOrderNo)
    .maybeSingle();
  if (werr) throw werr;
  if (!wo) throw new Error("工单不存在");
  if (wo.status === "完工" || wo.status === "超期完工") {
    throw new Error("工单已完工/超期完工，不能再创建工单报工");
  }
  if (wo.status === "开立" || wo.status === "下发") {
    throw new Error("工单还未开工（开立/下发），请先开工后再做工单报工");
  }

  // 同一工单+批号下的下一个完工顺序号
  const { data: existing, error: eerr } = await c
    .from("work_order_reports")
    .select("finish_seq")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", input.batch_no)
    .order("finish_seq", { ascending: false })
    .limit(1);
  if (eerr) throw eerr;
  const finishSeq = existing && existing.length > 0 ? Number((existing[0] as { finish_seq: number }).finish_seq) + 1 : 1;

  // 同一工单同时只允许 1 个 status=活跃 的批次
  const { data: active, error: aerr } = await c
    .from("work_order_reports")
    .select("id, batch_no")
    .eq("work_order_no", workOrderNo)
    .eq("status", "活跃")
    .maybeSingle();
  if (aerr) throw aerr;
  if (active) {
    throw new Error(
      `该工单存在未关闭的工单报工单（批次号：${cn(active.batch_no) || "—"}），请先关闭后再开新批次`,
    );
  }

  const insert = {
    work_order_no: workOrderNo,
    batch_no: input.batch_no,
    finish_seq: finishSeq,
    start_at: input.start_at,
    skilled_workers: Math.max(0, Math.floor(input.skilled_workers ?? 0)),
    general_workers: Math.max(0, Math.floor(input.general_workers ?? 0)),
    labor_workers: Math.max(0, Math.floor(input.labor_workers ?? 0)),
    other_workers: 0,
    abnormal_minutes: 0,
    notes: input.notes ?? "",
    status: "活跃",
    fill_time: new Date().toISOString(),
  };
  const { data, error } = await c
    .from("work_order_reports")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return toWorkOrderReportView(data as Record<string, unknown>);
}

export interface UpdateWorkOrderReportInput {
  report_id: string;
  work_order_id: string;
  batch_no?: string;
  start_at?: string;
  change_line_at?: string | null;
  skilled_workers?: number;
  general_workers?: number;
  labor_workers?: number;
  cleanup_minutes?: number;
  notes?: string;
}

export async function updateWorkOrderReport(input: UpdateWorkOrderReportInput) {
  const c = getSupabaseClient();
  const workOrderNo = input.work_order_id;
  // 先取出 work_order_reports 行（按 id）
  const { data: existing, error: gerr } = await c
    .from("work_order_reports")
    .select("*")
    .eq("id", input.report_id)
    .maybeSingle();
  if (gerr) throw gerr;
  if (!existing) throw new Error("工单报工单不存在");
  const existRow = existing as Record<string, unknown>;
  if (cn(existRow.work_order_no) !== workOrderNo) {
    throw new Error("工单报工单不属于该工单");
  }
  if (cn(existRow.status) === "已关闭") {
    throw new Error("工单报工单已关闭，不允许修改");
  }
  const { data: wo } = await c
    .from("work_orders")
    .select("id, status")
    .eq("order_no", workOrderNo)
    .maybeSingle();
  if (!wo) throw new Error("工单不存在");
  if (wo.status === "完工" || wo.status === "超期完工") {
    throw new Error("工单已完工/超期完工，不允许修改工单报工");
  }
  // 顺便重算 man_hours（如果 end_at 或异常分钟有变）
  const startAt = input.start_at ?? cn(existRow.start_at);
  const endAt = existRow.end_at ? cn(existRow.end_at) : null;
  const skilled = input.skilled_workers !== undefined ? input.skilled_workers : Number(existRow.skilled_workers ?? 0);
  const general = input.general_workers !== undefined ? input.general_workers : Number(existRow.general_workers ?? 0);
  const labor = input.labor_workers !== undefined ? input.labor_workers : Number(existRow.labor_workers ?? 0);
  const other = Number(existRow.other_workers ?? 0);
  const abnormal = Number(existRow.abnormal_minutes ?? 0);
  let manHours = Number(existRow.man_hours ?? 0);
  if (endAt) {
    const minutes = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000 - abnormal;
    const people = Math.max(0, skilled) + Math.max(0, general) + Math.max(0, labor) + Math.max(0, other);
    manHours = minutes > 0 ? Math.round((minutes * people) / 60 * 100) / 100 : 0;
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), man_hours: manHours };
  if (input.batch_no !== undefined) patch.batch_no = input.batch_no;
  if (input.start_at !== undefined) patch.start_at = input.start_at;
  if (input.skilled_workers !== undefined) patch.skilled_workers = Math.max(0, Math.floor(input.skilled_workers));
  if (input.general_workers !== undefined) patch.general_workers = Math.max(0, Math.floor(input.general_workers));
  if (input.labor_workers !== undefined) patch.labor_workers = Math.max(0, Math.floor(input.labor_workers));
  if (input.notes !== undefined) patch.notes = input.notes;
  const { data, error } = await c
    .from("work_order_reports")
    .update(patch)
    .eq("id", input.report_id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("工单报工单不存在");
  return toWorkOrderReportView(data as Record<string, unknown>);
}

export async function deleteWorkOrderReport(reportId: string) {
  const c = getSupabaseClient();
  // 先删除关联的工序报工 + 停机 + 不良
  const { data: wor } = await c
    .from("work_order_reports")
    .select("work_order_no, batch_no, finish_seq")
    .eq("id", reportId)
    .maybeSingle();
  if (!wor) throw new Error("工单报工单不存在");
  const worRow = wor as Record<string, unknown>;
  const workOrderNo = cn(worRow.work_order_no);
  const batchNo = cn(worRow.batch_no);
  const finishSeq = Number(worRow.finish_seq ?? 0);
  await c.from("operation_reports").delete().eq("work_order_no", workOrderNo).eq("batch_no", batchNo).eq("finish_seq", finishSeq);
  await c.from("operation_defects").delete().eq("work_order_no", workOrderNo).eq("batch_no", batchNo).eq("finish_seq", finishSeq);
  await c.from("equipment_downtime").delete().eq("work_order_no", workOrderNo).eq("batch_no", batchNo).eq("finish_seq", finishSeq);
  const { error } = await c
    .from("work_order_reports")
    .delete()
    .eq("id", reportId);
  if (error) throw error;
  return { id: reportId };
}

/**
 * 关闭工单报工单（批次）。关闭后该工单才能再开新批次。
 */
export async function closeWorkOrderReport(reportId: string) {
  const c = getSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await c
    .from("work_order_reports")
    .update({ status: "已关闭", closed_at: now, updated_at: now })
    .eq("id", reportId)
    .eq("status", "活跃")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("工单报工单不存在或已关闭");
  return toWorkOrderReportView(data as Record<string, unknown>);
}

/**
 * 重新打开工单报工单（仅当同工单无其它活跃批次时）
 */
export async function reopenWorkOrderReport(reportId: string) {
  const c = getSupabaseClient();
  const { data: target, error: terr } = await c
    .from("work_order_reports")
    .select("id, work_order_no, status")
    .eq("id", reportId)
    .maybeSingle();
  if (terr) throw terr;
  if (!target) throw new Error("工单报工单不存在");
  const targetRow = target as Record<string, unknown>;
  if (cn(targetRow.status) === "活跃") return toWorkOrderReportView(targetRow);

  // 检查同工单是否已有活跃
  const { data: other, error: oerr } = await c
    .from("work_order_reports")
    .select("id, batch_no")
    .eq("work_order_no", cn(targetRow.work_order_no))
    .eq("status", "活跃")
    .neq("id", reportId)
    .maybeSingle();
  if (oerr) throw oerr;
  if (other) {
    throw new Error(`该工单已有活跃的工单报工单（批次号：${cn(other.batch_no) || "—"}），请先关闭后再打开本批次`);
  }

  const now = new Date().toISOString();
  const { data, error } = await c
    .from("work_order_reports")
    .update({ status: "活跃", closed_at: null, updated_at: now })
    .eq("id", reportId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("工单报工单不存在");
  return toWorkOrderReportView(data as Record<string, unknown>);
}

export interface CreateOperationReportInput {
  work_order_report_id: string;   // 旧字段：实际是 `${workOrderNo}-${batchNo}-${finishSeq}` 拼接
  operation_id: string;            // 旧字段：实际是 process_code
  process_name: string;
  sequence: number;
  material_code?: string;
  material_name?: string;
  material_batch_no?: string;
  input_qty: number;
  defect_qty: number;
  notes?: string;
}

export async function createOperationReport(input: CreateOperationReportInput) {
  const c = getSupabaseClient();
  const parsed = parseWorId(input.work_order_report_id);
  if (!parsed) {
    throw new Error("工单报工单 ID 格式错误");
  }
  const { workOrderNo, batchNo, finishSeq } = parsed;
  const processCode = input.operation_id;

  // 1) 校验工单报工存在 & 未关闭
  const { data: wor, error: werr } = await c
    .from("work_order_reports")
    .select("id, status, start_at")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .maybeSingle();
  if (werr) throw werr;
  if (!wor) throw new Error("工单报工单不存在");
  if (cn(wor.status) === "已关闭") {
    throw new Error("工单报工单已关闭，不能再添加工序报工");
  }
  if (!cn(wor.start_at)) throw new Error("工单报工单尚未填写开始时间");

  // 2) 第一道工序未完成前,后续工序不允许报工
  if (input.sequence > 1) {
    const { data: firstOp, error: fErr } = await c
      .from("operation_reports")
      .select("id")
      .eq("work_order_no", workOrderNo)
      .eq("batch_no", batchNo)
      .eq("finish_seq", finishSeq)
      .eq("sequence", 1)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!firstOp) {
      throw new Error("请先完成第 1 道工序报工后,再报后续工序");
    }
  }

  const totalProcesses = 8;
  const isFirst = input.sequence === 1;
  const isLast = input.sequence === totalProcesses;
  const inputQty = Math.max(0, Math.floor(input.input_qty ?? 0));
  const defectQty = Math.max(0, Math.floor(input.defect_qty ?? 0));
  // 旧 UI 总是传 input_qty + defect_qty；新模型下：首道用 input_qty 当 quantity，末道也用 input_qty 当 quantity，中间 6 道用 null
  let quantity: number | null;
  if (isFirst || isLast) {
    if (inputQty <= 0) {
      throw new Error(isFirst ? "首道工序必须填写投入数量" : "末道工序必须填写成品数量");
    }
    quantity = inputQty;
  } else {
    quantity = null;
  }
  // 不良数拆分：旧 UI 用 defect_qty（合计），新模型用 incoming + process 各 2 字段
  // 这里把合计写到 process_defect_lid（占位），保持 qualified_qty = quantity - defectQty
  const qualified = quantity == null ? 0 : Math.max(0, quantity - defectQty);
  const { data, error } = await c
    .from("operation_reports")
    .upsert(
      {
        work_order_no: workOrderNo,
        batch_no: batchNo,
        finish_seq: finishSeq,
        process_code: processCode,
        process_name: input.process_name,
        sequence: Math.max(0, Math.floor(input.sequence ?? 0)),
        quantity,
        incoming_defect_piece: 0,
        incoming_defect_lid: 0,
        process_defect_piece: 0,
        process_defect_lid: defectQty,
        incoming_defect_total: 0,
        process_defect_total: defectQty,
        qualified_qty: qualified,
      },
      { onConflict: "work_order_no,batch_no,finish_seq,process_code" },
    )
    .select()
    .single();
  if (error) throw error;

  // 同步到 work_order_operations（兼容旧 UI / 老业务）
  await syncOperationAggregate(workOrderNo, processCode, qualified, defectQty);

  return toOperationReportView(data as Record<string, unknown>);
}

export interface UpdateOperationReportInput {
  report_id: string;
  work_order_report_id: string;
  operation_id?: string;
  process_name?: string;
  sequence?: number;
  material_code?: string;
  material_name?: string;
  material_batch_no?: string;
  input_qty?: number;
  defect_qty?: number;
  notes?: string;
}

export async function updateOperationReport(input: UpdateOperationReportInput) {
  const c = getSupabaseClient();
  const parsed = parseWorId(input.work_order_report_id);
  if (!parsed) throw new Error("工单报工单 ID 格式错误");
  const { workOrderNo, batchNo, finishSeq } = parsed;

  // 校验工单报工
  const { data: wor } = await c
    .from("work_order_reports")
    .select("id, status")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .maybeSingle();
  if (!wor) throw new Error("工单报工单不存在");
  if (cn((wor as Record<string, unknown>).status) === "已关闭") {
    throw new Error("工单报工单已关闭，不能再修改工序报工");
  }

  // 校验工序报工存在
  const { data: existing, error: gerr } = await c
    .from("operation_reports")
    .select("*")
    .eq("id", input.report_id)
    .maybeSingle();
  if (gerr) throw gerr;
  if (!existing) throw new Error("工序报工单不存在");
  const existRow = existing as Record<string, unknown>;
  if (cn(existRow.work_order_no) !== workOrderNo) {
    throw new Error("工序报工单不属于该工单报工单");
  }

  // 校验工单
  const { data: wo } = await c
    .from("work_orders")
    .select("id, status")
    .eq("order_no", workOrderNo)
    .maybeSingle();
  if (!wo) throw new Error("工单不存在");
  if (wo.status === "完工" || wo.status === "超期完工") {
    throw new Error("工单已完工/超期完工，不允许修改工序报工");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.process_name !== undefined) patch.process_name = input.process_name;
  if (input.sequence !== undefined) patch.sequence = Math.max(0, Math.floor(input.sequence));
  const newInputQty =
    input.input_qty !== undefined
      ? Math.max(0, Math.floor(input.input_qty))
      : Number(existRow.quantity ?? 0);
  const newDefectQty =
    input.defect_qty !== undefined
      ? Math.max(0, Math.floor(input.defect_qty))
      : Number(existRow.process_defect_total ?? 0);
  const seq = Number(existRow.sequence ?? 0);
  const totalProcesses = 8;
  const isFirst = seq === 1;
  const isLast = seq === totalProcesses;
  let quantity: number | null;
  if (isFirst || isLast) {
    quantity = newInputQty;
  } else {
    quantity = null;
  }
  patch.quantity = quantity;
  patch.process_defect_lid = newDefectQty;
  patch.process_defect_total = newDefectQty;
  patch.qualified_qty = quantity == null ? 0 : Math.max(0, quantity - newDefectQty);

  const { data, error } = await c
    .from("operation_reports")
    .update(patch)
    .eq("id", input.report_id)
    .select()
    .single();
  if (error) throw error;

  // 同步 work_order_operations
  await syncOperationAggregate(
    workOrderNo,
    cn(existRow.process_code),
    Number((data as Record<string, unknown>).qualified_qty ?? 0),
    newDefectQty,
  );

  return toOperationReportView(data as Record<string, unknown>);
}

export async function deleteOperationReport(reportId: string) {
  const c = getSupabaseClient();
  // 拿到工序报工的 process_code + work_order_no 以便同步
  const { data: op } = await c
    .from("operation_reports")
    .select("id, work_order_no, batch_no, finish_seq, process_code, sequence, qualified_qty, process_defect_total")
    .eq("id", reportId)
    .maybeSingle();
  if (!op) throw new Error("工序报工单不存在");
  const opRow = op as Record<string, unknown>;
  // 首道工序存在后续工序时,不允许删除
  if (Number(opRow.sequence ?? 0) === 1) {
    const { count } = await c
      .from("operation_reports")
      .select("id", { count: "exact", head: true })
      .eq("work_order_no", cn(opRow.work_order_no))
      .eq("batch_no", cn(opRow.batch_no))
      .eq("finish_seq", Number(opRow.finish_seq ?? 0))
      .gt("sequence", 1);
    if ((count ?? 0) > 0) {
      throw new Error("首道工序报工存在后续工序,不可删除");
    }
  }
  const { error } = await c.from("operation_reports").delete().eq("id", reportId);
  if (error) throw error;
  await syncOperationAggregate(
    cn(opRow.work_order_no),
    cn(opRow.process_code),
    0,
    0,
  );
  return { id: reportId };
}

async function syncOperationAggregate(
  workOrderNo: string,
  processCode: string,
  qualified: number,
  defect: number,
) {
  // 兼容旧业务:同步到 work_order_operations（按 process_name 匹配）
  if (!processCode) return;
  const c = getSupabaseClient();
  const { data: dict } = await c
    .from("process_dictionary")
    .select("process_name")
    .eq("process_code", processCode)
    .maybeSingle();
  const processName = cn((dict as { process_name?: string } | null)?.process_name);
  if (!processName) return;
  const { data: ops } = await c
    .from("work_order_operations")
    .select("id")
    .eq("work_order_id", workOrderNo)
    .eq("operation_name", processName);
  if (!ops || ops.length === 0) return;
  for (const op of ops) {
    await c
      .from("work_order_operations")
      .update({
        good_quantity: qualified,
        scrap_quantity: defect,
        end_time: new Date().toISOString(),
      })
      .eq("id", (op as { id: string }).id);
  }
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

  // 质量数据（日报表已下线，置 0）
  const sumInspected = 0;
  const sumGood = 0;
  const sumScrap = 0;
  const firstPassRate = 0;
  const defectRate = 0;

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

// ==================== 报工管理（顶层菜单） ====================

export interface ReportSummary {
  workOrder: WorkOrder;
  reports: Array<{
    workOrderReport: WorkOrderReport;
    operationReports: OperationReport[];
  }>;
  totalGood: number;
  totalDefect: number;
}

/**
 * 列出全部报工数据，按工单聚合。
 * 默认仅展示有过报工的工单（生产中/暂停/完工 等）
 */
export async function listReportSummaries(): Promise<ReportSummary[]> {
  const c = getSupabaseClient();
  // 1) 先取所有有报工的工单 id
  const { data: wos, error: woErr } = await c
    .from("work_orders")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (woErr) throw woErr;

  const woList = (wos ?? []) as Record<string, unknown>[];
  if (woList.length === 0) return [];

  const woIds = woList.map((w) => String(w.id));
  const { data: woReports, error: wrErr } = await c
    .from("work_order_reports")
    .select("*")
    .in("work_order_id", woIds)
    .order("start_at", { ascending: false });
  if (wrErr) throw wrErr;
  const woReportList = (woReports ?? []) as Record<string, unknown>[];

  // 过滤：只保留有报工的工单
  const woIdsWithReports = new Set(woReportList.map((r) => String(r.work_order_id)));
  const filteredWos = woList.filter((w) => woIdsWithReports.has(String(w.id)));

  if (woReportList.length === 0) return [];

  const woReportIds = woReportList.map((r) => String(r.id));
  const { data: opReports, error: opErr } = await c
    .from("operation_reports")
    .select("*")
    .in("work_order_report_id", woReportIds)
    .order("sequence", { ascending: true });
  if (opErr) throw opErr;
  const opReportList = (opReports ?? []) as Record<string, unknown>[];

  const opByWoReport = new Map<string, OperationReport[]>();
  for (const op of opReportList) {
    const k = String((op as { work_order_report_id: string }).work_order_report_id);
    if (!opByWoReport.has(k)) opByWoReport.set(k, []);
    opByWoReport.get(k)!.push(toOperationReportView(op));
  }

  const result: ReportSummary[] = filteredWos.map((w) => {
    const wo = toWoView(w);
    const reports = woReportList
      .filter((r) => String((r as { work_order_id: string }).work_order_id) === wo.id)
      .map((r) => {
        const wor = toWorkOrderReportView(r);
        return {
          workOrderReport: wor,
          operationReports: opByWoReport.get(wor.id) ?? [],
        };
      });
    let totalGood = 0;
    let totalDefect = 0;
    for (const r of reports) {
      for (const op of r.operationReports) {
        totalGood += Number(op.qualified_qty ?? 0);
        totalDefect += Number(op.defect_qty ?? 0);
      }
    }
    return { workOrder: wo, reports, totalGood, totalDefect };
  });

  return result;
}

// ==================== 报工模块 V2（2026-06-23 重构） ====================

export type WorkOrderReportStatus = "活跃" | "已关闭";

export interface WorkOrderReportV2 {
  id: string;
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  startAt: string;
  endAt: string | null;
  skilledWorkers: number;
  generalWorkers: number;
  laborWorkers: number;
  otherWorkers: number;
  abnormalMinutes: number;
  manHours: number;
  fillTime: string | null;
  status: WorkOrderReportStatus;
  closedAt: string | null;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OperationReportV2 {
  id: string;
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  processCode: string;
  processName: string;
  sequence: number;
  quantity: number | null;
  incomingDefectPiece: number;
  incomingDefectLid: number;
  processDefectPiece: number;
  processDefectLid: number;
  incomingDefectTotal: number;
  processDefectTotal: number;
  qualifiedQty: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OperationDefectV2 {
  id: string;
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  processCode: string;
  defectCategory: string;
  defectName: string;
  defectQty: number;
  unit: string;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EquipmentDowntimeV2 {
  id: string;
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  equipmentCode: string;
  downtimeStart: string;
  downtimeType: string;
  faultDesc: string;
  fixAt: string | null;
  durationMinutes: number;
  confirmedBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

function toWoReportV2(r: Record<string, unknown>): WorkOrderReportV2 {
  return {
    id: String(r.id),
    workOrderNo: String(r.work_order_no ?? ""),
    batchNo: String(r.batch_no ?? ""),
    finishSeq: Number(r.finish_seq ?? 0),
    startAt: String(r.start_at ?? ""),
    endAt: r.end_at ? String(r.end_at) : null,
    skilledWorkers: Number(r.skilled_workers ?? 0),
    generalWorkers: Number(r.general_workers ?? 0),
    laborWorkers: Number(r.labor_workers ?? 0),
    otherWorkers: Number(r.other_workers ?? 0),
    abnormalMinutes: Number(r.abnormal_minutes ?? 0),
    manHours: Number(r.man_hours ?? 0),
    fillTime: r.fill_time ? String(r.fill_time) : null,
    status: (r.status === "已关闭" ? "已关闭" : "活跃") as WorkOrderReportStatus,
    closedAt: r.closed_at ? String(r.closed_at) : null,
    notes: String(r.notes ?? ""),
    createdAt: r.created_at ? String(r.created_at) : null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

function toOpReportV2(r: Record<string, unknown>): OperationReportV2 {
  return {
    id: String(r.id),
    workOrderNo: String(r.work_order_no ?? ""),
    batchNo: String(r.batch_no ?? ""),
    finishSeq: Number(r.finish_seq ?? 0),
    processCode: String(r.process_code ?? ""),
    processName: String(r.process_name ?? ""),
    sequence: Number(r.sequence ?? 0),
    quantity: r.quantity == null ? null : Number(r.quantity),
    incomingDefectPiece: Number(r.incoming_defect_piece ?? 0),
    incomingDefectLid: Number(r.incoming_defect_lid ?? 0),
    processDefectPiece: Number(r.process_defect_piece ?? 0),
    processDefectLid: Number(r.process_defect_lid ?? 0),
    incomingDefectTotal: Number(r.incoming_defect_total ?? 0),
    processDefectTotal: Number(r.process_defect_total ?? 0),
    qualifiedQty: Number(r.qualified_qty ?? 0),
    createdAt: r.created_at ? String(r.created_at) : null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

function toDefectV2(r: Record<string, unknown>): OperationDefectV2 {
  return {
    id: String(r.id),
    workOrderNo: String(r.work_order_no ?? ""),
    batchNo: String(r.batch_no ?? ""),
    finishSeq: Number(r.finish_seq ?? 0),
    processCode: String(r.process_code ?? ""),
    defectCategory: String(r.defect_category ?? ""),
    defectName: String(r.defect_name ?? ""),
    defectQty: Number(r.defect_qty ?? 0),
    unit: String(r.unit ?? ""),
    notes: String(r.notes ?? ""),
    createdAt: r.created_at ? String(r.created_at) : null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

function toDowntimeV2(r: Record<string, unknown>): EquipmentDowntimeV2 {
  return {
    id: String(r.id),
    workOrderNo: String(r.work_order_no ?? ""),
    batchNo: String(r.batch_no ?? ""),
    finishSeq: Number(r.finish_seq ?? 0),
    equipmentCode: String(r.equipment_code ?? ""),
    downtimeStart: String(r.downtime_start ?? ""),
    downtimeType: String(r.downtime_type ?? ""),
    faultDesc: String(r.fault_desc ?? ""),
    fixAt: r.fix_at ? String(r.fix_at) : null,
    durationMinutes: Number(r.duration_minutes ?? 0),
    confirmedBy: String(r.confirmed_by ?? ""),
    createdAt: r.created_at ? String(r.created_at) : null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

function toInt(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function calcManHours(
  startAt: string,
  endAt: string | null,
  abnormalMinutes: number,
  skilled: number,
  general: number,
  labor: number,
  other: number
): number {
  if (!endAt) return 0;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (end <= start) return 0;
  const minutes = (end - start) / 60000 - Number(abnormalMinutes ?? 0);
  if (minutes <= 0) return 0;
  const people = Number(skilled ?? 0) + Number(general ?? 0) + Number(labor ?? 0) + Number(other ?? 0);
  return Math.round((minutes * people) / 60 * 100) / 100;
}

function calcQualified(quantity: number | null, incoming: number, process: number): number {
  if (quantity == null) return 0;
  const v = quantity - incoming - process;
  return v < 0 ? 0 : v;
}

export interface ProcessDictionaryItem {
  id: string;
  processCode: string;
  processName: string;
  sequence: number;
}

export async function listProcessDictionary(): Promise<ProcessDictionaryItem[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("process_dictionary")
    .select("id, process_code, process_name, sequence")
    .order("sequence", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    processCode: String(r.process_code),
    processName: String(r.process_name),
    sequence: Number(r.sequence ?? 0),
  }));
}

async function nextFinishSeq(
  c: ReturnType<typeof getSupabaseClient>,
  workOrderNo: string,
  batchNo: string
): Promise<number> {
  const { data, error } = await c
    .from("work_order_reports")
    .select("finish_seq")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .order("finish_seq", { ascending: false })
    .limit(1);
  if (error) throw error;
  const list = (data ?? []) as Array<{ finish_seq: number }>;
  return list.length === 0 ? 1 : Number(list[0].finish_seq) + 1;
}

export async function listWorkOrderReportsV2(workOrderNo: string): Promise<WorkOrderReportV2[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("work_order_reports")
    .select("*")
    .eq("work_order_no", workOrderNo)
    .order("finish_seq", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toWoReportV2(r as Record<string, unknown>));
}

export async function listAllWorkOrderReportsV2(limit = 500): Promise<WorkOrderReportV2[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("work_order_reports")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => toWoReportV2(r as Record<string, unknown>));
}

export interface CreateWorkOrderReportV2Input {
  workOrderNo: string;
  batchNo: string;
  startAt: string;
  skilledWorkers?: number;
  generalWorkers?: number;
  laborWorkers?: number;
  otherWorkers?: number;
  abnormalMinutes?: number;
  notes?: string;
}

export async function createWorkOrderReportV2(input: CreateWorkOrderReportV2Input): Promise<WorkOrderReportV2> {
  const c = getSupabaseClient();
  const seq = await nextFinishSeq(c, input.workOrderNo, input.batchNo);
  const { data, error } = await c
    .from("work_order_reports")
    .insert({
      work_order_no: input.workOrderNo,
      batch_no: input.batchNo,
      finish_seq: seq,
      start_at: input.startAt,
      skilled_workers: toInt(input.skilledWorkers),
      general_workers: toInt(input.generalWorkers),
      labor_workers: toInt(input.laborWorkers),
      other_workers: toInt(input.otherWorkers),
      abnormal_minutes: toInt(input.abnormalMinutes),
      notes: input.notes ?? "",
      status: "活跃",
      fill_time: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return toWoReportV2(data as Record<string, unknown>);
}

export interface UpdateWorkOrderReportV2Input {
  endAt?: string | null;
  skilledWorkers?: number;
  generalWorkers?: number;
  laborWorkers?: number;
  otherWorkers?: number;
  abnormalMinutes?: number;
  notes?: string;
}

export async function updateWorkOrderReportV2(
  id: string,
  patch: UpdateWorkOrderReportV2Input
): Promise<WorkOrderReportV2> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("work_order_reports")
    .select("*")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  const curRow = cur as Record<string, unknown>;
  if (curRow.status === "已关闭") {
    throw new Error("已关闭的报工批次不可修改");
  }
  const startAt = String(curRow.start_at ?? "");
  const newEnd = patch.endAt === undefined ? (cn(curRow.end_at) || null) : patch.endAt;
  if (newEnd && startAt && new Date(newEnd).getTime() < new Date(startAt).getTime()) {
    throw new Error("完工时间不能小于开工时间");
  }
  const skilled = patch.skilledWorkers ?? Number(curRow.skilled_workers ?? 0);
  const general = patch.generalWorkers ?? Number(curRow.general_workers ?? 0);
  const labor = patch.laborWorkers ?? Number(curRow.labor_workers ?? 0);
  const other = patch.otherWorkers ?? Number(curRow.other_workers ?? 0);
  const abnormal = patch.abnormalMinutes ?? Number(curRow.abnormal_minutes ?? 0);
  const manHours = calcManHours(startAt, newEnd, abnormal, skilled, general, labor, other);
  const { data, error } = await c
    .from("work_order_reports")
    .update({
      end_at: newEnd,
      skilled_workers: toInt(skilled),
      general_workers: toInt(general),
      labor_workers: toInt(labor),
      other_workers: toInt(other),
      abnormal_minutes: toInt(abnormal),
      man_hours: manHours,
      notes: patch.notes ?? String(curRow.notes ?? ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toWoReportV2(data as Record<string, unknown>);
}

export async function deleteWorkOrderReportV2(id: string): Promise<void> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  if ((cur as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可删除");
  }
  const { error } = await c.from("work_order_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function closeWorkOrderReportV2(id: string): Promise<WorkOrderReportV2> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  if ((cur as { status?: string })?.status === "已关闭") {
    throw new Error("批次已关闭");
  }
  const { data, error } = await c
    .from("work_order_reports")
    .update({
      status: "已关闭",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toWoReportV2(data as Record<string, unknown>);
}

export async function listOperationReportsV2(
  workOrderNo: string,
  batchNo: string,
  finishSeq: number
): Promise<OperationReportV2[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("operation_reports")
    .select("*")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toOpReportV2(r as Record<string, unknown>));
}

export interface UpsertOperationReportV2Input {
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  processCode: string;
  processName: string;
  sequence: number;
  quantity?: number | null;
  incomingDefectPiece?: number;
  incomingDefectLid?: number;
  processDefectPiece?: number;
  processDefectLid?: number;
}

export async function upsertOperationReportV2(input: UpsertOperationReportV2Input): Promise<OperationReportV2> {
  const c = getSupabaseClient();
  const { data: batch, error: batchErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", input.workOrderNo)
    .eq("batch_no", input.batchNo)
    .eq("finish_seq", input.finishSeq)
    .single();
  if (batchErr) throw batchErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可添加工序报工");
  }
  if (input.sequence > 1) {
    const { data: firstOp, error: firstErr } = await c
      .from("operation_reports")
      .select("id")
      .eq("work_order_no", input.workOrderNo)
      .eq("batch_no", input.batchNo)
      .eq("finish_seq", input.finishSeq)
      .eq("sequence", 1)
      .maybeSingle();
    if (firstErr) throw firstErr;
    if (!firstOp) {
      throw new Error("请先完成第 1 道工序报工后,再报后续工序");
    }
  }
  const totalProcesses = 8;
  const isFirst = input.sequence === 1;
  const isLast = input.sequence === totalProcesses;
  let quantity: number | null = input.quantity ?? null;
  if (isFirst || isLast) {
    if (quantity == null || quantity < 0) {
      throw new Error(isFirst ? "首道工序必须填写投入数量" : "末道工序必须填写成品数量");
    }
  } else {
    quantity = null;
  }
  const incoming = toInt(input.incomingDefectPiece) + toInt(input.incomingDefectLid);
  const process = toInt(input.processDefectPiece) + toInt(input.processDefectLid);
  const qualified = calcQualified(quantity, incoming, process);
  const row = {
    work_order_no: input.workOrderNo,
    batch_no: input.batchNo,
    finish_seq: input.finishSeq,
    process_code: input.processCode,
    process_name: input.processName,
    sequence: input.sequence,
    quantity,
    incoming_defect_piece: toInt(input.incomingDefectPiece),
    incoming_defect_lid: toInt(input.incomingDefectLid),
    process_defect_piece: toInt(input.processDefectPiece),
    process_defect_lid: toInt(input.processDefectLid),
    incoming_defect_total: incoming,
    process_defect_total: process,
    qualified_qty: qualified,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await c
    .from("operation_reports")
    .upsert(row, { onConflict: "work_order_no,batch_no,finish_seq,process_code" })
    .select()
    .single();
  if (error) throw error;
  return toOpReportV2(data as Record<string, unknown>);
}

export async function deleteOperationReportV2(id: string): Promise<void> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("operation_reports")
    .select("work_order_no, batch_no, finish_seq, sequence")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  const curRow = cur as Record<string, unknown>;
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", curRow.work_order_no)
    .eq("batch_no", curRow.batch_no)
    .eq("finish_seq", curRow.finish_seq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可删除工序报工");
  }
  if (Number(curRow.sequence ?? 0) === 1) {
    const { count, error: cntErr } = await c
      .from("operation_reports")
      .select("id", { count: "exact", head: true })
      .eq("work_order_no", curRow.work_order_no)
      .eq("batch_no", curRow.batch_no)
      .eq("finish_seq", curRow.finish_seq)
      .gt("sequence", 1);
    if (cntErr) throw cntErr;
    if ((count ?? 0) > 0) {
      throw new Error("首道工序报工存在后续工序,不可删除");
    }
  }
  const { error } = await c.from("operation_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function listOperationDefectsV2(
  workOrderNo: string,
  batchNo: string,
  finishSeq: number,
  processCode: string
): Promise<OperationDefectV2[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("operation_defects")
    .select("*")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .eq("process_code", processCode)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toDefectV2(r as Record<string, unknown>));
}

export interface UpsertOperationDefectV2Input {
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  processCode: string;
  defectCategory: string;
  defectName: string;
  defectQty: number;
  unit: string;
  notes?: string;
}

export async function upsertOperationDefectV2(input: UpsertOperationDefectV2Input): Promise<OperationDefectV2> {
  const c = getSupabaseClient();
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", input.workOrderNo)
    .eq("batch_no", input.batchNo)
    .eq("finish_seq", input.finishSeq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可操作不良记录");
  }
  const { data: op, error: opErr } = await c
    .from("operation_reports")
    .select("id")
    .eq("work_order_no", input.workOrderNo)
    .eq("batch_no", input.batchNo)
    .eq("finish_seq", input.finishSeq)
    .eq("process_code", input.processCode)
    .maybeSingle();
  if (opErr) throw opErr;
  if (!op) {
    throw new Error("请先完成对应工序报工");
  }
  const row = {
    work_order_no: input.workOrderNo,
    batch_no: input.batchNo,
    finish_seq: input.finishSeq,
    process_code: input.processCode,
    defect_category: input.defectCategory,
    defect_name: input.defectName,
    defect_qty: toInt(input.defectQty),
    unit: input.unit,
    notes: input.notes ?? "",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await c
    .from("operation_defects")
    .upsert(row, {
      onConflict: "work_order_no,batch_no,finish_seq,process_code,defect_category,defect_name,unit",
    })
    .select()
    .single();
  if (error) throw error;
  return toDefectV2(data as Record<string, unknown>);
}

export async function deleteOperationDefectV2(id: string): Promise<void> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("operation_defects")
    .select("work_order_no, batch_no, finish_seq")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  const curRow = cur as Record<string, unknown>;
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", curRow.work_order_no)
    .eq("batch_no", curRow.batch_no)
    .eq("finish_seq", curRow.finish_seq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可操作不良记录");
  }
  const { error } = await c.from("operation_defects").delete().eq("id", id);
  if (error) throw error;
}

export async function listEquipmentDowntimeV2(
  workOrderNo: string,
  batchNo: string,
  finishSeq: number
): Promise<EquipmentDowntimeV2[]> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("equipment_downtime")
    .select("*")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .order("downtime_start", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toDowntimeV2(r as Record<string, unknown>));
}

export interface CreateEquipmentDowntimeV2Input {
  workOrderNo: string;
  batchNo: string;
  finishSeq: number;
  equipmentCode: string;
  downtimeStart: string;
  downtimeType?: string;
  faultDesc?: string;
  fixAt?: string | null;
  confirmedBy?: string;
}

export async function createEquipmentDowntimeV2(input: CreateEquipmentDowntimeV2Input): Promise<EquipmentDowntimeV2> {
  const c = getSupabaseClient();
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", input.workOrderNo)
    .eq("batch_no", input.batchNo)
    .eq("finish_seq", input.finishSeq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可操作停机记录");
  }
  const fixAt = input.fixAt ?? null;
  let durationMinutes = 0;
  if (fixAt) {
    const ms = new Date(fixAt).getTime() - new Date(input.downtimeStart).getTime();
    durationMinutes = Math.max(0, Math.round(ms / 60000));
  }
  const { data, error } = await c
    .from("equipment_downtime")
    .insert({
      work_order_no: input.workOrderNo,
      batch_no: input.batchNo,
      finish_seq: input.finishSeq,
      equipment_code: input.equipmentCode,
      downtime_start: input.downtimeStart,
      downtime_type: input.downtimeType ?? "",
      fault_desc: input.faultDesc ?? "",
      fix_at: fixAt,
      duration_minutes: durationMinutes,
      confirmed_by: input.confirmedBy ?? "",
    })
    .select()
    .single();
  if (error) throw error;
  return toDowntimeV2(data as Record<string, unknown>);
}

export async function updateEquipmentDowntimeV2(
  id: string,
  patch: Partial<CreateEquipmentDowntimeV2Input>
): Promise<EquipmentDowntimeV2> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("equipment_downtime")
    .select("*")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  const curRow = cur as Record<string, unknown>;
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", curRow.work_order_no)
    .eq("batch_no", curRow.batch_no)
    .eq("finish_seq", curRow.finish_seq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可操作停机记录");
  }
  const fixAt = patch.fixAt !== undefined ? patch.fixAt : (cn(curRow.fix_at) || null);
  const downtimeStart = patch.downtimeStart ?? String(curRow.downtime_start ?? "");
  let durationMinutes = Number(curRow.duration_minutes ?? 0);
  if (fixAt) {
    const ms = new Date(fixAt).getTime() - new Date(downtimeStart).getTime();
    durationMinutes = Math.max(0, Math.round(ms / 60000));
  }
  const { data, error } = await c
    .from("equipment_downtime")
    .update({
      equipment_code: patch.equipmentCode ?? String(curRow.equipment_code ?? ""),
      downtime_start: downtimeStart,
      downtime_type: patch.downtimeType ?? String(curRow.downtime_type ?? ""),
      fault_desc: patch.faultDesc ?? String(curRow.fault_desc ?? ""),
      fix_at: fixAt,
      duration_minutes: durationMinutes,
      confirmed_by: patch.confirmedBy ?? String(curRow.confirmed_by ?? ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toDowntimeV2(data as Record<string, unknown>);
}

export async function deleteEquipmentDowntimeV2(id: string): Promise<void> {
  const c = getSupabaseClient();
  const { data: cur, error: curErr } = await c
    .from("equipment_downtime")
    .select("work_order_no, batch_no, finish_seq")
    .eq("id", id)
    .single();
  if (curErr) throw curErr;
  const curRow = cur as Record<string, unknown>;
  const { data: batch, error: bErr } = await c
    .from("work_order_reports")
    .select("status")
    .eq("work_order_no", curRow.work_order_no)
    .eq("batch_no", curRow.batch_no)
    .eq("finish_seq", curRow.finish_seq)
    .single();
  if (bErr) throw bErr;
  if ((batch as { status?: string })?.status === "已关闭") {
    throw new Error("已关闭的报工批次不可操作停机记录");
  }
  const { error } = await c.from("equipment_downtime").delete().eq("id", id);
  if (error) throw error;
}

export interface CompletionCheckResult {
  ok: boolean;
  message: string;
  data?: {
    firstInput: number;
    lastOutput: number;
    totalIncomingDefect: number;
    totalProcessDefect: number;
    expected: number;
    diff: number;
  };
}

export async function checkCompletionBalanceV2(
  workOrderNo: string,
  batchNo: string,
  finishSeq: number
): Promise<CompletionCheckResult> {
  const c = getSupabaseClient();
  const { data, error } = await c
    .from("operation_reports")
    .select("sequence, quantity, incoming_defect_total, process_defect_total")
    .eq("work_order_no", workOrderNo)
    .eq("batch_no", batchNo)
    .eq("finish_seq", finishSeq)
    .order("sequence", { ascending: true });
  if (error) throw error;
  const list = (data ?? []) as Array<{
    sequence: number;
    quantity: number | null;
    incoming_defect_total: number;
    process_defect_total: number;
  }>;
  if (list.length < 8) {
    return { ok: false, message: `工序报工未完成（当前 ${list.length}/8 道）` };
  }
  const first = list[0];
  const last = list[list.length - 1];
  if (first.quantity == null) {
    return { ok: false, message: "首道工序未填写投入数量" };
  }
  if (last.quantity == null) {
    return { ok: false, message: "末道工序未填写成品数量" };
  }
  const totalIncoming = list.reduce((s, r) => s + Number(r.incoming_defect_total ?? 0), 0);
  const totalProcess = list.reduce((s, r) => s + Number(r.process_defect_total ?? 0), 0);
  const expected = Number(first.quantity) - totalIncoming - totalProcess;
  const diff = expected - Number(last.quantity);
  if (diff === 0) {
    return {
      ok: true,
      message: "完工一致性校验通过",
      data: {
        firstInput: Number(first.quantity),
        lastOutput: Number(last.quantity),
        totalIncomingDefect: totalIncoming,
        totalProcessDefect: totalProcess,
        expected,
        diff,
      },
    };
  }
  return {
    ok: false,
    message: `完工一致性校验不通过: 期望 ${expected}, 实际 ${last.quantity}, 差额 ${diff}`,
    data: {
      firstInput: Number(first.quantity),
      lastOutput: Number(last.quantity),
      totalIncomingDefect: totalIncoming,
      totalProcessDefect: totalProcess,
      expected,
      diff,
    },
  };
}

export interface ReportSummaryV2 {
  workOrder: WorkOrder;
  batches: WorkOrderReportV2[];
  operationReports: OperationReportV2[];
  totalQualified: number;
  totalDefect: number;
}

export async function listReportSummariesV2(): Promise<ReportSummaryV2[]> {
  const c = getSupabaseClient();
  const { data: reports, error: rErr } = await c
    .from("work_order_reports")
    .select("*")
    .order("start_at", { ascending: false })
    .limit(500);
  if (rErr) throw rErr;
  const reportList = (reports ?? []) as Record<string, unknown>[];
  if (reportList.length === 0) return [];
  const { data: ops, error: oErr } = await c
    .from("operation_reports")
    .select("*")
    .limit(2000);
  if (oErr) throw oErr;
  const opList = (ops ?? []) as Record<string, unknown>[];
  const workOrderNos = Array.from(new Set(reportList.map((r) => String(r.work_order_no))));
  const { data: wos, error: wErr } = await c
    .from("work_orders")
    .select("*")
    .in("order_no", workOrderNos);
  if (wErr) throw wErr;
  const woList = (wos ?? []) as Record<string, unknown>[];
  const result: ReportSummaryV2[] = [];
  for (const wo of woList) {
    const woOrderNo = String(wo.order_no ?? "");
    const batches = reportList
      .filter((r) => String(r.work_order_no) === woOrderNo)
      .map((r) => toWoReportV2(r));
    const opReports = opList
      .filter((o) => {
        const woNo = String(o.work_order_no ?? "");
        const batch = String(o.batch_no ?? "");
        const seq = Number(o.finish_seq ?? 0);
        return batches.some(
          (b) =>
            b.workOrderNo === woNo &&
            b.batchNo === batch &&
            b.finishSeq === seq
        );
      })
      .map((o) => toOpReportV2(o));
    const totalQualified = opReports.reduce((s, o) => s + Number(o.qualifiedQty ?? 0), 0);
    const totalDefect = opReports.reduce(
      (s, o) => s + Number(o.incomingDefectTotal ?? 0) + Number(o.processDefectTotal ?? 0),
      0
    );
    result.push({
      workOrder: toWoView(wo),
      batches,
      operationReports: opReports,
      totalQualified,
      totalDefect,
    });
  }
  return result;
}
