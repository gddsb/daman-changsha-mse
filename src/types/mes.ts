/**
 * MES 业务模型类型定义
 *
 * 前端组件直接消费这里的"视图类型"（英文状态、归一化字段）。
 * 真实数据库行（中文状态、snake_case 字段）由 src/lib/mes-service.ts 在数据访问层做归一化。
 */

export type WorkOrderStatus =
  | "planned"
  | "released"
  | "in_progress"
  | "paused"
  | "completed"
  | "closed";
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

export interface WorkOrderReport {
  id: string;
  work_order_id: string;
  work_order_no: string | null;
  operation_id: string | null;
  process_name: string | null;
  operator_name: string;
  line_code: string | null;
  line_name: string | null;
  shift_no: string | null;
  report_type: string;
  good_quantity: number;
  scrap_quantity: number;
  scrap_reason: string | null;
  product_code: string | null;
  product_name: string | null;
  can_spec: string | null;
  can_height: number;
  batch_no: string | null;
  inspector_name: string | null;
  reported_at: string;
  notes: string | null;
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

export interface DailyQualityReport {
  id: string;
  report_date: string;
  line_code: string;
  line_name: string | null;
  process_name: string;
  product_code: string;
  product_name: string;
  can_spec: string | null;
  can_height: number;
  shift_no: string | null;
  total_inspected: number;
  total_good: number;
  total_scrap: number;
  pass_rate: number;
  scrap_rate: number;
  defect_breakdown: unknown;
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
