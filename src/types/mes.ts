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
export type InspectionType = "first" | "in_process" | "final" | "incoming";
export type InspectionResult = "pass" | "fail" | "conditional";
export type DefectCategory = "dimension" | "appearance" | "material" | "assembly" | "function";
export type DefectSeverity = "critical" | "major" | "minor";

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
  operation_name: string;
  equipment_code: string | null;
  equipment_name: string | null;
  standard_time_minutes: number | null;
  status: OperationStatus;
  operator_name: string | null;
  start_time: string | null;
  end_time: string | null;
  good_quantity: number;
  scrap_quantity: number;
  notes: string | null;
}

export interface WorkOrderReport {
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

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: string;
  model: string | null;
  manufacturer: string | null;
  workshop: string | null;
  workshop_code: string | null;
  workshop_name: string | null;
  status: EquipmentStatus;
  current_work_order_no: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  oee_target: number | null;
}

export interface EquipmentOEE {
  id: string;
  equipment_code: string;
  record_date: string;
  planned_time_minutes: number;
  run_time_minutes: number;
  downtime_minutes: number;
  good_quantity: number;
  total_quantity: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

export interface EquipmentMaintenance {
  id: string;
  equipment_code: string;
  equipment_name: string;
  maintenance_type: string;
  planned_date: string;
  completed_date: string | null;
  operator_name: string | null;
  status: MaintenanceStatus;
  description: string | null;
  cost: number | null;
  notes: string | null;
}

export interface DefectCode {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
}

export interface QualityInspection {
  id: string;
  inspection_no: string;
  work_order_id: string | null;
  work_order_no: string | null;
  product_code: string;
  product_name: string;
  batch_no: string | null;
  inspection_type: InspectionType;
  sample_size: number;
  pass_quantity: number;
  fail_quantity: number;
  result: InspectionResult;
  defect_code: string | null;
  defect_name: string | null;
  defect_description: string | null;
  inspector_name: string;
  inspection_time: string;
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

export interface Product {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string | null;
}

export interface Workshop {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface OutputTrendPoint {
  date: string;
  planned: number;
  actual: number;
}

export interface EquipmentMatrixItem {
  id: string;
  code: string;
  name: string;
  status: EquipmentStatus;
  workshop: string | null;
}

export interface RecentDefect {
  id: string;
  inspection_no: string;
  product_name: string;
  defect_code: string | null;
  defect_description: string | null;
  inspection_time: string;
}

export interface DashboardSummary {
  today: {
    plannedQty: number;
    completedQty: number;
    completionRate: number;
    delta: number;
  };
  equipment: {
    total: number;
    running: number;
    idle: number;
    maintenance: number;
    breakdown: number;
    availability: number;
    performance: number;
    quality: number;
    oee: number;
  };
  quality: {
    firstPassRate: number;
    inspectionCount: number;
    defectCount: number;
    defectRate: number;
  };
  outputTrend: OutputTrendPoint[];
  equipmentMatrix: EquipmentMatrixItem[];
  activeWorkOrders: WorkOrder[];
  recentDefects: RecentDefect[];
}
