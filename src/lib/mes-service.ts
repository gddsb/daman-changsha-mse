/**
 * MES 业务数据访问层
 *
 * 全部使用 Supabase SDK（client.from()），按 snake_case 字段名。
 * 服务端使用 service_role_key 绕过 RLS。
 *
 * DB 中存放的中文状态值，在返回前端前统一在 toView* 函数中归一化为英文枚举，
 * 前端只看到稳定的英文键（planned / in_progress 等），不直接接触中文字面量。
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";
import type { Database } from "@/storage/database/shared/types";

type WoRow = Database["public"]["Tables"]["work_orders"]["Row"];
type WoOpRow = Database["public"]["Tables"]["work_order_operations"]["Row"];
type WoReportRow = Database["public"]["Tables"]["work_order_reports"]["Row"];
type EqRow = Database["public"]["Tables"]["equipment"]["Row"];
type EqMaintRow = Database["public"]["Tables"]["equipment_maintenance"]["Row"];
type InspRow = Database["public"]["Tables"]["quality_inspections"]["Row"];
type DefectRow = Database["public"]["Tables"]["defect_codes"]["Row"];

// ---------- 状态归一化 ----------
export const WO_STATUS_MAP: Record<string, string> = {
  计划中: "planned",
  已下发: "released",
  生产中: "in_progress",
  已暂停: "paused",
  已完成: "completed",
  已关闭: "closed",
};
export const WO_STATUS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(WO_STATUS_MAP).map(([k, v]) => [v, k]),
);
const WO_OP_STATUS_MAP: Record<string, string> = {
  待开始: "pending",
  进行中: "in_progress",
  已完成: "completed",
  跳过: "skipped",
};
const WO_OP_STATUS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(WO_OP_STATUS_MAP).map(([k, v]) => [v, k]),
);
const EQ_STATUS_MAP: Record<string, string> = {
  运行中: "running",
  待机: "idle",
  维保中: "maintenance",
  故障: "breakdown",
  离线: "offline",
};
const EQ_STATUS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(EQ_STATUS_MAP).map(([k, v]) => [v, k]),
);
const MAINT_STATUS_MAP: Record<string, string> = {
  待执行: "pending",
  执行中: "in_progress",
  已完成: "completed",
  已逾期: "overdue",
};
const INSP_TYPE_MAP: Record<string, string> = {
  首件检验: "first",
  巡回检验: "in_process",
  末件检验: "final",
  入库检验: "incoming",
};
const INSP_TYPE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(INSP_TYPE_MAP).map(([k, v]) => [v, k]),
);
const INSP_RESULT_MAP: Record<string, string> = {
  合格: "pass",
  不合格: "fail",
  让步接收: "conditional",
};
const INSP_RESULT_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(INSP_RESULT_MAP).map(([k, v]) => [v, k]),
);

// View 端类型（前端只消费这些）
export interface WorkOrderView {
  id: string;
  order_no: string;
  sales_order_no: string | null;
  product_code: string;
  product_name: string;
  specification: string | null;
  quantity: number;
  completed_quantity: number;
  scrap_quantity: number;
  status: string;
  priority: number;
  workshop: string | null;
  workshop_code: string | null;
  customer_name: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface WorkOrderOpView {
  id: string;
  work_order_id: string;
  sequence: number;
  operation_name: string;
  equipment_code: string | null;
  equipment_name: string | null;
  standard_time_minutes: number | null;
  status: string;
  operator_name: string | null;
  start_time: string | null;
  end_time: string | null;
  good_quantity: number;
  scrap_quantity: number;
  notes: string | null;
}
export interface WorkOrderReportView {
  id: string;
  work_order_id: string;
  operation_id: string | null;
  report_type: string;
  operator_name: string;
  good_quantity: number;
  scrap_quantity: number;
  scrap_reason: string | null;
  reported_at: string;
  notes: string | null;
}
export interface EquipmentView {
  id: string;
  code: string;
  name: string;
  type: string;
  model: string | null;
  manufacturer: string | null;
  workshop: string | null;
  workshop_code: string | null;
  workshop_name: string | null;
  status: string;
  current_work_order_no: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  oee_target: number | null;
}
export interface MaintenanceView {
  id: string;
  equipment_code: string;
  equipment_name: string;
  maintenance_type: string;
  planned_date: string;
  completed_date: string | null;
  operator_name: string | null;
  status: string;
  description: string | null;
  cost: number | null;
  notes: string | null;
}
export interface InspectionView {
  id: string;
  inspection_no: string;
  work_order_id: string | null;
  work_order_no: string | null;
  inspection_type: string;
  product_code: string;
  product_name: string;
  batch_no: string | null;
  inspector_name: string;
  inspection_time: string;
  sample_size: number;
  fail_quantity: number;
  pass_quantity: number;
  result: string;
  defect_code: string | null;
  defect_name: string | null;
  defect_description: string | null;
  notes: string | null;
}
export interface DefectCodeView {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
}

function toWorkOrderView(r: WoRow): WorkOrderView {
  return {
    id: r.id,
    order_no: r.order_no,
    sales_order_no: r.sales_order_no,
    product_code: r.product_code,
    product_name: r.product_name,
    specification: r.specification,
    quantity: r.planned_quantity,
    completed_quantity: r.completed_quantity ?? 0,
    scrap_quantity: r.scrap_quantity ?? 0,
    status: WO_STATUS_MAP[r.status] ?? r.status,
    priority: r.priority ?? 3,
    workshop: r.workshop_name,
    workshop_code: r.workshop_code,
    customer_name: r.customer_name,
    planned_start_date: r.planned_start_date,
    planned_end_date: r.planned_end_date,
    actual_start_date: r.actual_start_date,
    actual_end_date: r.actual_end_date,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
function toWorkOrderOpView(r: WoOpRow): WorkOrderOpView {
  return {
    id: r.id,
    work_order_id: r.work_order_id,
    sequence: r.sequence,
    operation_name: r.operation_name,
    equipment_code: r.equipment_code,
    equipment_name: r.equipment_name,
    standard_time_minutes: r.standard_time_minutes,
    status: WO_OP_STATUS_MAP[r.status] ?? r.status,
    operator_name: r.operator_name,
    start_time: r.start_time,
    end_time: r.end_time,
    good_quantity: r.good_quantity ?? 0,
    scrap_quantity: r.scrap_quantity ?? 0,
    notes: r.notes,
  };
}
function toReportView(r: WoReportRow): WorkOrderReportView {
  return {
    id: r.id,
    work_order_id: r.work_order_id,
    operation_id: r.operation_id,
    report_type: r.report_type,
    operator_name: r.operator_name,
    good_quantity: r.good_quantity,
    scrap_quantity: r.scrap_quantity,
    scrap_reason: r.scrap_reason,
    reported_at: r.reported_at,
    notes: r.notes,
  };
}
function toEquipmentView(r: EqRow): EquipmentView {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    model: r.model,
    manufacturer: r.manufacturer,
    workshop: r.workshop_name,
    workshop_code: r.workshop_code,
    workshop_name: r.workshop_name,
    status: EQ_STATUS_MAP[r.status] ?? r.status,
    current_work_order_no: r.current_work_order_no,
    last_maintenance_date: r.last_maintenance_date,
    next_maintenance_date: r.next_maintenance_date,
    oee_target: r.oee_target != null ? Number(r.oee_target) : null,
  };
}
function toMaintenanceView(r: EqMaintRow): MaintenanceView {
  return {
    id: r.id,
    equipment_code: r.equipment_code,
    equipment_name: r.equipment_name,
    maintenance_type: r.maintenance_type,
    planned_date: r.planned_date,
    completed_date: r.completed_date,
    operator_name: r.operator_name,
    status: MAINT_STATUS_MAP[r.status] ?? r.status,
    description: r.description,
    cost: r.cost != null ? Number(r.cost) : null,
    notes: r.notes,
  };
}
function toInspectionView(
  r: InspRow,
  defectMap: Map<string, DefectRow>,
  woMap: Map<string, string>,
): InspectionView {
  const dc = r.defect_code ? defectMap.get(r.defect_code) : null;
  return {
    id: r.id,
    inspection_no: r.inspection_no,
    work_order_id: r.work_order_id,
    work_order_no: r.work_order_id ? woMap.get(r.work_order_id) ?? null : null,
    inspection_type: INSP_TYPE_MAP[r.inspection_type] ?? r.inspection_type,
    product_code: r.product_code,
    product_name: r.product_name,
    batch_no: r.batch_no,
    inspector_name: r.inspector_name,
    inspection_time: r.inspection_time,
    sample_size: r.sample_size,
    fail_quantity: r.fail_quantity,
    pass_quantity: r.pass_quantity,
    result: INSP_RESULT_MAP[r.result] ?? r.result,
    defect_code: r.defect_code,
    defect_name: dc?.name ?? null,
    defect_description: r.defect_description,
    notes: r.notes,
  };
}
function toDefectView(r: DefectRow): DefectCodeView {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    severity: r.severity,
  };
}

export const STATUS_HELPERS = {
  toWoDb: (v: string) => WO_STATUS_REVERSE[v] ?? v,
  toOpDb: (v: string) => WO_OP_STATUS_REVERSE[v] ?? v,
  toEqDb: (v: string) => EQ_STATUS_REVERSE[v] ?? v,
  toInspTypeDb: (v: string) => INSP_TYPE_REVERSE[v] ?? v,
  toInspResultDb: (v: string) => INSP_RESULT_REVERSE[v] ?? v,
};

// ---------- 类型 ----------

export interface Workshop {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface U9SalesOrderRow {
  id: string;
  sales_order_no: string;
  customer_code: string | null;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string | null;
  delivery_date: string;
  status: string;
  synced_at: string;
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string | null;
  process_route: string | null;
}

export interface WorkOrderRow {
  id: string;
  order_no: string;
  sales_order_no: string | null;
  product_code: string;
  product_name: string;
  specification: string | null;
  planned_quantity: number;
  completed_quantity: number;
  scrap_quantity: number;
  status: string;
  priority: number;
  workshop_code: string | null;
  workshop_name: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderOperationRow {
  id: string;
  work_order_id: string;
  sequence: number;
  operation_name: string;
  workstation: string | null;
  equipment_code: string | null;
  standard_time_minutes: number | null;
  status: string;
  operator_name: string | null;
  good_quantity: number;
  scrap_quantity: number;
  start_time: string | null;
  end_time: string | null;
}

export interface WorkOrderReportRow {
  id: string;
  work_order_id: string;
  operation_id: string | null;
  report_type: string;
  operator_name: string;
  good_quantity: number;
  scrap_quantity: number;
  scrap_reason: string | null;
  reported_at: string;
  notes: string | null;
}

export interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  type: string;
  model: string | null;
  manufacturer: string | null;
  workshop_code: string | null;
  workshop_name: string | null;
  status: string;
  current_work_order_no: string | null;
  current_operator: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  oee_target: string | null;
  purchase_date: string | null;
  notes: string | null;
}

export interface EquipmentOeeRow {
  id: string;
  equipment_code: string;
  record_date: string;
  planned_time_minutes: number;
  run_time_minutes: number;
  downtime_minutes: number;
  good_quantity: number;
  total_quantity: number;
  availability: string;
  performance: string;
  quality: string;
  oee: string;
}

export interface EquipmentMaintenanceRow {
  id: string;
  equipment_code: string;
  equipment_name: string;
  maintenance_type: string;
  planned_date: string;
  completed_date: string | null;
  operator_name: string | null;
  status: string;
  description: string | null;
  cost: string | null;
  notes: string | null;
  created_at: string;
}

export interface DefectCodeRow {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
  description: string | null;
}

export interface QualityInspectionRow {
  id: string;
  inspection_no: string;
  work_order_id: string | null;
  work_order_no: string | null;
  inspection_type: string;
  product_code: string;
  product_name: string;
  batch_no: string | null;
  inspector_name: string;
  inspection_time: string;
  sample_size: number;
  pass_quantity: number;
  fail_quantity: number;
  result: string;
  defect_code: string | null;
  defect_description: string | null;
  measurements: unknown | null;
  notes: string | null;
  created_at: string;
}

// ---------- 通用工具 ----------

function db() {
  return getSupabaseClient();
}

function check<T>(data: T | null, error: unknown, msg: string): T {
  if (error) throw new Error(`${msg}: ${(error as { message: string }).message}`);
  if (data === null) throw new Error(`${msg}: 返回空数据`);
  return data;
}

// ---------- 车间 ----------

export async function listWorkshops(): Promise<Workshop[]> {
  const { data, error } = await db()
    .from("workshops")
    .select("id, code, name, description")
    .order("code");
  return check(data ?? [], error, "查询车间失败");
}

// ---------- U9 销售订单 ----------

export async function listU9SalesOrders(): Promise<U9SalesOrderRow[]> {
  const { data, error } = await db()
    .from("u9_sales_orders")
    .select("*")
    .order("delivery_date", { ascending: true });
  return check(data ?? [], error, "查询 U9 销售订单失败");
}

export async function upsertU9SalesOrders(
  rows: Omit<U9SalesOrderRow, "id" | "synced_at">[],
): Promise<void> {
  const { error } = await db()
    .from("u9_sales_orders")
    .upsert(rows, { onConflict: "sales_order_no" });
  if (error) throw new Error(`同步 U9 销售订单失败: ${error.message}`);
}

// ---------- 物料字典 ----------

export async function listProducts(): Promise<ProductRow[]> {
  const { data, error } = await db()
    .from("products")
    .select("id, code, name, specification, unit, process_route")
    .order("code");
  return check(data ?? [], error, "查询物料字典失败");
}

export async function upsertProducts(
  rows: Omit<ProductRow, "id">[],
): Promise<void> {
  const { error } = await db()
    .from("products")
    .upsert(rows, { onConflict: "code" });
  if (error) throw new Error(`同步物料字典失败: ${error.message}`);
}

// ---------- 工单 ----------

export interface ListWorkOrderParams {
  status?: string;
  workshopCode?: string;
  search?: string;
  limit?: number;
}

export async function listWorkOrders(
  params: ListWorkOrderParams = {},
): Promise<WorkOrderView[]> {
  let query = db()
    .from("work_orders")
    .select(
      "id, order_no, sales_order_no, product_code, product_name, specification, planned_quantity, completed_quantity, scrap_quantity, status, priority, workshop_code, workshop_name, planned_start_date, planned_end_date, actual_start_date, actual_end_date, customer_name, notes, created_at, updated_at",
    )
    .order("priority", { ascending: true })
    .order("planned_start_date", { ascending: true });

  if (params.status) {
    const dbStatus = STATUS_HELPERS.toWoDb(params.status);
    query = query.eq("status", dbStatus);
  }
  if (params.workshopCode) query = query.eq("workshop_code", params.workshopCode);
  if (params.search) {
    query = query.or(
      `order_no.ilike.%${params.search}%,product_name.ilike.%${params.search}%,product_code.ilike.%${params.search}%`,
    );
  }
  if (params.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  return check((data ?? []) as WoRow[], error, "查询工单失败").map(toWorkOrderView);
}

export async function getWorkOrder(id: string): Promise<WorkOrderView | null> {
  const { data, error } = await db()
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询工单详情失败: ${error.message}`);
  return data ? toWorkOrderView(data as WoRow) : null;
}

export async function listWorkOrderOperations(
  workOrderId: string,
): Promise<WorkOrderOpView[]> {
  const { data, error } = await db()
    .from("work_order_operations")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("sequence", { ascending: true });
  return check((data ?? []) as WoOpRow[], error, "查询工序失败").map(toWorkOrderOpView);
}

export async function listWorkOrderReports(
  workOrderId: string,
): Promise<WorkOrderReportView[]> {
  const { data, error } = await db()
    .from("work_order_reports")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("reported_at", { ascending: false });
  return check((data ?? []) as WoReportRow[], error, "查询报工记录失败").map(toReportView);
}

export interface CreateWorkOrderInput {
  order_no: string;
  sales_order_no?: string | null;
  product_code: string;
  product_name: string;
  specification?: string | null;
  planned_quantity: number;
  priority?: number;
  workshop_code?: string | null;
  workshop_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  customer_name?: string | null;
  notes?: string | null;
}

export async function createWorkOrder(
  input: CreateWorkOrderInput,
): Promise<WorkOrderView> {
  const { data, error } = await db()
    .from("work_orders")
    .insert({ ...input, status: "计划中" })
    .select()
    .single();
  if (error) throw new Error(`创建工单失败: ${error.message}`);
  if (!data) throw new Error("创建工单失败: 返回空数据");
  return toWorkOrderView(data as WoRow);
}

/**
 * 接受 view 端英文状态值（planned / released / in_progress / paused / completed / closed）
 * 内部转换为 DB 中文枚举再写入
 */
export async function updateWorkOrderStatus(
  id: string,
  status: string,
  extra: Partial<WoRow> = {},
): Promise<void> {
  const dbStatus = STATUS_HELPERS.toWoDb(status);
  const patch: Record<string, unknown> = {
    status: dbStatus,
    updated_at: new Date().toISOString(),
  };
  if (dbStatus === "生产中" && !extra.actual_start_date) {
    patch.actual_start_date = new Date().toISOString();
  }
  if (dbStatus === "已完成" && !extra.actual_end_date) {
    patch.actual_end_date = new Date().toISOString();
  }
  Object.assign(patch, extra);
  const { error } = await db().from("work_orders").update(patch).eq("id", id);
  if (error) throw new Error(`更新工单失败: ${error.message}`);
}

export interface CreateReportInput {
  work_order_id: string;
  operation_id?: string | null;
  report_type: string;
  operator_name: string;
  good_quantity: number;
  scrap_quantity: number;
  scrap_reason?: string | null;
  notes?: string | null;
}

export async function createWorkOrderReport(
  input: CreateReportInput,
): Promise<WorkOrderReportView> {
  const { data, error } = await db()
    .from("work_order_reports")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(`创建报工记录失败: ${error.message}`);
  if (!data) throw new Error("创建报工记录失败: 返回空数据");
  return toReportView(data as WoReportRow);
}

export async function updateOperation(
  id: string,
  patch: Partial<WorkOrderOpView>,
): Promise<void> {
  const mapped: Record<string, unknown> = { ...patch };
  if (patch.status) {
    mapped.status = STATUS_HELPERS.toOpDb(patch.status);
  }
  const { error } = await db()
    .from("work_order_operations")
    .update(mapped)
    .eq("id", id);
  if (error) throw new Error(`更新工序失败: ${error.message}`);
}

// ---------- 设备 ----------

export interface ListEquipmentParams {
  status?: string;
  workshopCode?: string;
  type?: string;
  search?: string;
}

export async function listEquipment(
  params: ListEquipmentParams = {},
): Promise<EquipmentView[]> {
  let query = db()
    .from("equipment")
    .select("*")
    .order("workshop_code")
    .order("code");
  if (params.status) {
    const dbStatus = STATUS_HELPERS.toEqDb(params.status);
    query = query.eq("status", dbStatus);
  }
  if (params.workshopCode) query = query.eq("workshop_code", params.workshopCode);
  if (params.type) query = query.eq("type", params.type);
  if (params.search) {
    query = query.or(
      `code.ilike.%${params.search}%,name.ilike.%${params.search}%`,
    );
  }
  const { data, error } = await query;
  return check((data ?? []) as EqRow[], error, "查询设备失败").map(toEquipmentView);
}

export async function getEquipment(
  id: string,
): Promise<EquipmentView | null> {
  const { data, error } = await db()
    .from("equipment")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询设备详情失败: ${error.message}`);
  return data ? toEquipmentView(data as EqRow) : null;
}

export async function listEquipmentOee(days = 7): Promise<EquipmentOeeRow[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("equipment_oee")
    .select("*")
    .gte("record_date", startStr)
    .order("record_date", { ascending: true });
  return check((data ?? []) as Database["public"]["Tables"]["equipment_oee"]["Row"][], error, "查询 OEE 失败");
}

export async function listEquipmentMaintenance(
  params: { status?: string } = {},
): Promise<MaintenanceView[]> {
  let query = db()
    .from("equipment_maintenance")
    .select("*")
    .order("planned_date", { ascending: true });
  if (params.status) query = query.eq("status", params.status);
  const { data, error } = await query;
  return check(
    (data ?? []) as Database["public"]["Tables"]["equipment_maintenance"]["Row"][],
    error,
    "查询维保记录失败",
  ).map(toMaintenanceView);
}

export async function updateEquipmentStatus(
  id: string,
  patch: Partial<EquipmentView>,
): Promise<void> {
  const mapped: Record<string, unknown> = { ...patch };
  if (patch.status) {
    mapped.status = STATUS_HELPERS.toEqDb(patch.status);
  }
  const { error } = await db().from("equipment").update(mapped).eq("id", id);
  if (error) throw new Error(`更新设备失败: ${error.message}`);
}

export interface CreateMaintenanceInput {
  equipment_code: string;
  equipment_name: string;
  maintenance_type: string;
  planned_date: string;
  description?: string | null;
  notes?: string | null;
}

export async function createMaintenance(
  input: CreateMaintenanceInput,
): Promise<MaintenanceView> {
  const { data, error } = await db()
    .from("equipment_maintenance")
    .insert({ ...input, status: "待执行" })
    .select()
    .single();
  if (error) throw new Error(`创建维保记录失败: ${error.message}`);
  if (!data) throw new Error("创建维保记录失败: 返回空数据");
  return toMaintenanceView(data as EqMaintRow);
}

export async function completeMaintenance(
  id: string,
  operatorName: string,
  cost: number | null,
  notes: string | null,
): Promise<void> {
  const { error } = await db()
    .from("equipment_maintenance")
    .update({
      status: "已完成",
      completed_date: new Date().toISOString().slice(0, 10),
      operator_name: operatorName,
      cost: cost?.toFixed(2) ?? null,
      notes,
    })
    .eq("id", id);
  if (error) throw new Error(`完结维保记录失败: ${error.message}`);
}

// ---------- 质量 ----------

export async function listDefectCodes(): Promise<DefectCodeView[]> {
  const { data, error } = await db()
    .from("defect_codes")
    .select("*")
    .order("code");
  return check((data ?? []) as DefectRow[], error, "查询不良代码失败").map(toDefectView);
}

export interface ListInspectionsParams {
  result?: string;
  inspectionType?: string;
  search?: string;
  limit?: number;
}

export async function listQualityInspections(
  params: ListInspectionsParams = {},
): Promise<InspectionView[]> {
  // 并行拉取 defect_codes 与 work_orders 用于反查
  const [inspRes, defectRes, woRes] = await Promise.all([
    (() => {
      let q = db()
        .from("quality_inspections")
        .select("*")
        .order("inspection_time", { ascending: false });
      if (params.result) {
        const dbRes = STATUS_HELPERS.toInspResultDb(params.result);
        q = q.eq("result", dbRes);
      }
      if (params.inspectionType) {
        const dbType = STATUS_HELPERS.toInspTypeDb(params.inspectionType);
        q = q.eq("inspection_type", dbType);
      }
      if (params.search) {
        q = q.or(
          `inspection_no.ilike.%${params.search}%,product_name.ilike.%${params.search}%,inspector_name.ilike.%${params.search}%`,
        );
      }
      if (params.limit) q = q.limit(params.limit);
      return q;
    })(),
    db().from("defect_codes").select("*"),
    db().from("work_orders").select("id, order_no"),
  ]);
  if (inspRes.error) throw new Error(`查询检验记录失败: ${inspRes.error.message}`);
  const inspList = (inspRes.data ?? []) as InspRow[];
  const defectMap = new Map<string, DefectRow>(
    ((defectRes.data ?? []) as DefectRow[]).map((d) => [d.code, d]),
  );
  const woMap = new Map<string, string>(
    ((woRes.data ?? []) as Array<{ id: string; order_no: string }>).map((w) => [w.id, w.order_no]),
  );
  return inspList.map((r) => toInspectionView(r, defectMap, woMap));
}

export interface CreateInspectionInput {
  inspection_no: string;
  work_order_id?: string | null;
  inspection_type: string;
  product_code: string;
  product_name: string;
  batch_no?: string | null;
  inspector_name: string;
  sample_size: number;
  pass_quantity: number;
  fail_quantity: number;
  result: string;
  defect_code?: string | null;
  defect_description?: string | null;
  notes?: string | null;
}

export async function createQualityInspection(
  input: CreateInspectionInput,
): Promise<InspectionView> {
  const payload = {
    ...input,
    inspection_type: STATUS_HELPERS.toInspTypeDb(input.inspection_type),
    result: STATUS_HELPERS.toInspResultDb(input.result),
  };
  const { data, error } = await db()
    .from("quality_inspections")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`创建检验记录失败: ${error.message}`);
  if (!data) throw new Error("创建检验记录失败: 返回空数据");
  return toInspectionView(data as InspRow, new Map(), new Map());
}

// ---------- 看板聚合查询 ----------

export interface DashboardSummary {
  /** 当日累计产量（件） */
  todayOutput: number;
  /** 今日目标（件） */
  todayTarget: number;
  /** 今日完成率 0-1 */
  todayCompletionRate: number;
  /** 同比变化（基于上个工作日），百分比 */
  trendPercent: number;
  /** 正在生产工单数 */
  activeWorkOrders: number;
  /** 待开工工单数 */
  pendingWorkOrders: number;
  /** 在线设备数 */
  runningEquipment: number;
  /** 总设备数 */
  totalEquipment: {
    value: number;
    trendPercent: number;
  };
  /** 平均 OEE（百分比 0-100） */
  avgOee: number;
  oeeTrend: number;
  /** 今日不良率（百分比） */
  defectRate: number;
  defectTrend: number;
  /** 7 日产量趋势 */
  outputTrend: Array<{ date: string; output: number; target: number }>;
  /** 设备状态分布 */
  equipmentStatusBreakdown: Array<{ status: string; count: number }>;
  /** 工单状态分布 */
  workOrderStatusBreakdown: Array<{ status: string; count: number }>;
  /** 不良 Top5 */
  topDefects: Array<{ code: string; name: string; count: number }>;
  /** 最近工单进度 */
  recentWorkOrders: Array<{
    id: string;
    order_no: string;
    product_name: string;
    completed_quantity: number;
    planned_quantity: number;
    status: string;
    workshop_name: string | null;
    customer_name: string | null;
  }>;
  /** 设备状态点阵 */
  equipmentMatrix: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    workshop_name: string | null;
    oee: number;
  }>;
  /** 不合格分布 */
  qualityBreakdown: {
    pass: number;
    fail: number;
    conditional: number;
    total: number;
  };
  /** 时间戳 */
  generatedAt: string;
}
