/**
 * MES 业务模型类型定义
 *
 * 前端组件直接消费这里的"视图类型"（英文状态、归一化字段）。
 * 真实数据库行（中文状态、snake_case 字段）由 src/lib/mes-service.ts 在数据访问层做归一化。
 */

// DB 直接存中文状态：开立 / 下发 / 生产中 / 暂停 / 完工 / 超期完工
export type WorkOrderStatus =
  | "开立"
  | "下发"
  | "生产中"
  | "暂停"
  | "完工"
  | "超期完工";
export type WorkOrderPriority = 1 | 2 | 3 | 4 | 5;
export type OperationStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ReportType = string; // 报工类型，由创建方传入
export type EquipmentStatus = "running" | "idle" | "maintenance" | "breakdown" | "offline";
export type MaintenanceType = string; // 日常点检/定期保养/故障维修 等
export type MaintenanceStatus = "pending" | "in_progress" | "completed" | "overdue";
export type InspectionType = "first" | "in_process" | "final" | "incoming" | "outgoing" | "patrol";
export type InspectionResult = "pass" | "fail" | "conditional";
export type DefectCategory = "dimension" | "appearance" | "material" | "assembly" | "function";
export type DefectSeverity = "critical" | "major" | "minor";

export interface DefectCode {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
}

export interface WorkOrder {
  id: string;
  order_no: string;
  sales_order_no: string | null;
  product_code: string;
  product_name: string;
  specification: string | null;
  quantity: number;
  completed_quantity: number;
  scrap_quantity: number;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  workshop: string | null;
  workshop_code: string | null;
  customer_name: string | null;
  line_code: string | null;
  line_name: string | null;
  order_type: string | null;
  unit: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderOperation {
  id: string;
  work_order_id: string;
  sequence: number;
  operation_code: string | null;
  operation_name: string;
  line_code: string | null;
  line_name: string | null;
  standard_time_minutes: number | null;
  status: OperationStatus;
  operator_name: string | null;
  good_quantity: number;
  scrap_quantity: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

// 工单报工主表（顶层批次报工：开批/人员/工时）。唯一索引 (work_order_no, batch_no, finish_seq)。
// 同一工单同时只允许 1 个 status=进行中 的批次。
// 字段双兼容：DB 实际存新字段（start_at/end_at/skilled_workers/...），但 UI 仍可访问旧字段名（change_line_at/cleanup_minutes/...）
export interface WorkOrderReport {
  id: string;
  work_order_no: string;
  work_order_id: string;                  // 兼容旧 UI（=work_order_no）
  batch_no: string;
  finish_seq: number;
  start_at: string;
  change_line_at: string | null;          // 兼容旧 UI（=start_at 拷贝）
  end_at: string | null;
  skilled_workers: number;
  general_workers: number;
  labor_workers: number;
  cleanup_minutes: number;                // 兼容旧 UI（=0，新模型无此字段）
  other_workers: number;
  abnormal_minutes: number;
  man_hours: number;
  fill_time: string;
  status: "活跃" | "已关闭";
  notes: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

// 工序报工主表（每道工序 1 条。首道 quantity=投入、中道留空、末道=成品）。唯一索引 (work_order_no, batch_no, finish_seq, process_code)。
// 字段双兼容：DB 实际存新字段（process_code/quantity/incoming_defect_*），但 UI 仍可访问旧字段名（operation_id/material_code/input_qty/defect_qty）
export interface OperationReport {
  id: string;
  work_order_no: string;
  work_order_id: string;                  // 兼容旧 UI
  batch_no: string;
  finish_seq: number;
  work_order_report_id: string;           // 兼容旧 UI（=work_order_no+batch_no+finish_seq 拼接）
  process_code: string;                   // 工序号（如 PROC-01）
  process_name: string;
  operation_id: string;                   // 兼容旧 UI（=process_code）
  sequence: number;
  material_code: string;                  // 兼容旧 UI（空）
  material_name: string;                  // 兼容旧 UI（=process_name 兼容）
  material_batch_no: string;              // 兼容旧 UI（空）
  quantity: number | null;                // 首道=投入、中道=留空、末道=成品
  input_qty: number;                      // 兼容旧 UI（=quantity || 0）
  incoming_defect_piece: number;
  incoming_defect_lid: number;
  process_defect_piece: number;
  process_defect_lid: number;
  incoming_defect_total: number;
  process_defect_total: number;
  defect_qty: number;                     // 兼容旧 UI（=incoming+process 合计）
  qualified_qty: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

// 工序不良子表（每个工序可挂多条不良记录）
export interface OperationDefect {
  id: string;
  work_order_no: string;
  work_order_id: string;                  // 兼容旧 UI
  batch_no: string;
  finish_seq: number;
  process_code: string;
  defect_category: "制程不良" | "来料不良";
  defect_name: string;
  defect_qty: number;
  unit: "小片" | "带盖";
  notes: string;
  created_at: string;
}

// 停机时间表（每个工单报工批次可挂多条停机记录，异常工时由本表汇总）
export interface EquipmentDowntime {
  id: string;
  work_order_no: string;
  work_order_id: string;                  // 兼容旧 UI
  batch_no: string;
  finish_seq: number;
  equipment_code: string;
  downtime_start: string | null;
  downtime_type: string;
  fault_desc: string;
  fix_at: string | null;
  duration_minutes: number | null;
  confirmed_by: string;
  notes: string;
  created_at: string;
}

// ====== 制罐业务新增 ======

export interface ProductionLine {
  id: string;
  code: string;
  name: string;
  workshop_code: string | null;
  workshop_name: string | null;
  status: string;
  description: string | null;
}

export interface ProductionPlan {
  id: string;
  plan_date: string;
  line_code: string;
  line_name: string | null;
  work_order_id: string;
  work_order_no: string;
  product_code: string;
  product_name: string;
  planned_quantity: number;
  priority: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string | null;
  process_route: string | null;
  customer_name: string | null;
  default_line_code: string | null;
  default_line_name: string | null;
}

export interface Workshop {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface QualityInspection {
  id: string;
  inspection_no: string;
  work_order_id: string | null;
  work_order_no: string | null;
  product_code: string;
  product_name: string;
  batch_no: string | null;
  inspection_type: string;
  sample_size: number;
  pass_quantity: number;
  fail_quantity: number;
  result: string;
  defect_code: string | null;
  defect_name: string | null;
  defect_description: string | null;
  inspector_name: string;
  inspection_time: string;
  line_code: string | null;
  line_name: string | null;
  process_name: string | null;
  shift_no: string;
  can_spec: string | null;
  can_height: number;
  notes: string | null;
}

export interface U9SalesOrder {
  id: string;
  sales_order_no: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  delivery_date: string | null;
  status: string;
  synced_at: string;
}

export interface OutputTrendPoint {
  date: string;
  planned: number;
  actual: number;
  scrap: number;
}

export interface LineStatusItem {
  code: string;
  name: string;
  status: string;
  orderCount: number;
  todayPlanned: number;
  todayActual: number;
  todayScrap: number;
  todayPassRate: number;
}

export interface ProcessDefectBucket {
  inspected: number;
  scrap: number;
  scrapRate: number;
}

export interface ProcessDefectStat {
  process: string;
  today: ProcessDefectBucket;
  yesterday: ProcessDefectBucket;
  month: ProcessDefectBucket;
}

export interface RecentDefect {
  id: string;
  work_order_no: string | null;
  product_name: string;
  process_name: string | null;
  line_name: string | null;
  defect_code: string | null;
  scrap_quantity: number;
  reported_at: string;
}

export interface DashboardSummary {
  today: {
    plannedQty: number;
    completedQty: number;
    completionRate: number;
    delta: number;
  };
  lines: {
    total: number;
    running: number;
    idle: number;
    maintenance: number;
  };
  quality: {
    firstPassRate: number;
    inspectedCount: number;
    defectCount: number;
    defectRate: number;
  };
  outputTrend: OutputTrendPoint[];
  lineStatus: LineStatusItem[];
  activeWorkOrders: WorkOrder[];
  recentDefects: RecentDefect[];
  processDefectStats: ProcessDefectStat[];
}
