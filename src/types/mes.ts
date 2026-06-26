/**
 * 前端 View 层类型（机加工 MES）
 *
 * 历史背景：本文件曾包含"制罐业务 V1/V2 报工"相关类型（WorkOrderReport /
 *   OperationReport / OperationDefect / EquipmentDowntime），2026-06 整体删除
 *   报工模块后这些类型已移除。新版 View 层只保留与报工无关的字典/主数据/质量/看板类型。
 */

export type WorkOrderStatus =
  | "开立"
  | "下发"
  | "生产中"
  | "暂停"
  | "完工"
  | "已关闭";

export interface WorkOrder {
  id: string;
  order_no: string;
  sales_order_no: string;
  product_code: string;
  product_name: string;
  specification: string;
  quantity: number;
  completed_quantity: number;
  scrap_quantity: number;
  status: WorkOrderStatus;
  line_code: string;
  line_name: string;
  workshop: string;
  workshop_code: string;
  customer_name: string;
  order_type: string;
  unit: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderOperation {
  id: string;
  work_order_id: string;
  sequence: number;
  operation_code: string;
  operation_name: string;
  planned_duration_minutes: number;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  notes: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: string;
  model: string;
  manufacturer: string;
  workshop_code: string;
  workshop_name: string;
  line_code: string;
  line_name: string;
  status: string;
  current_work_order_no: string;
  last_maintenance_date: string;
  next_maintenance_date: string;
  oee_target: number;
  created_at: string;
}

export interface EquipmentOee {
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
  completed_date: string;
  operator_name: string;
  status: string;
  description: string;
  cost: number;
  notes: string;
}

export interface DefectCode {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
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
  status: string;
  wo_status?: string; // 工单状态（用于限制拖拽/删除）
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

/** 看板：单道工序在某个时间桶内的不良率统计（每个桶分 inspected/scrap/scrapRate） */
export interface DefectBucket {
  inspected: number;
  scrap: number;
  scrapRate: number;
}

/** 看板：工序不良率（保留类型但 data 为空数组，因为报工模块已下线） */
export interface ProcessDefectStat {
  process: string;
  today: DefectBucket;
  yesterday: DefectBucket;
  month: DefectBucket;
}

export interface RecentDefect {
  id: string;
  work_order_no: string;
  product_name: string;
  process_name: string;
  line_name: string;
  defect_code: string;
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
    passCount: number;
    failCount: number;
    defectRate: number;
  };
  outputTrend: OutputTrendPoint[];
  lineStatus: LineStatusItem[];
  activeWorkOrders: WorkOrder[];
  processDefectStats: ProcessDefectStat[];
  recentDefects: RecentDefect[];
  lastUpdated: string;
}

// =====================================================================
// 报工管理（工单报工主表 + 4 张子表）
// =====================================================================

/** 报工状态：进行中 / 已关闭 */
export type WorkOrderReportStatus = "进行中" | "已关闭";

/** 报工关闭类型：自动 / 手工 */
export type WorkOrderReportCloseType = "auto" | "manual" | null;

/** 工单报工主表 */
export interface WorkOrderReport {
  id: string;
  report_no: string;
  work_order_id: string;
  work_order_no: string;
  /** 产品编号（来自工单） */
  product_code: string;
  /** 产品名称（来自工单） */
  product_name: string;
  /** 产品规格（来自工单） */
  specification: string;
  completion_seq: number;
  batch_no: string;
  start_time: string;
  end_time: string | null;
  skilled_worker_count: number;
  regular_worker_count: number;
  contract_worker_count: number;
  other_worker_count: number;
  input_quantity: number;
  pass_quantity: number;
  fail_quantity: number;
  is_closed: boolean;
  close_type: WorkOrderReportCloseType;
  created_at: string;
}

/** 工序报工子表（每批次的每道工序一条） */
export interface OperationReport {
  id: string;
  work_order_report_id: string;
  work_order_no: string;
  batch_no: string;
  operation_seq: number;
  operation_name: string;
  /** 投入数（自动计算：首道=制程汇总，后续=上一道pass） */
  input_quantity: number;
  pass_quantity: number;
  fail_quantity: number;
  /** 来料不良-小片 */
  incoming_piece: number;
  /** 来料不良-带盖 */
  incoming_cover: number;
  /** 制程不良-小片 */
  process_piece: number;
  /** 制程不良-带盖 */
  process_cover: number;
  report_time: string;
  created_at: string;
}

/** 工序不良子表（隶属于某道工序报工，可多条） */
export interface OperationDefect {
  id: string;
  operation_report_id: string | null;
  work_order_report_id: string;
  work_order_no: string;
  batch_no: string;
  operation_seq: number | null;
  defect_category: "制程不良" | "来料不良" | "检验报废";
  defect_name: string;
  defect_quantity: number;
  unit: "小片" | "带盖" | null;
  created_at: string;
}

/** 异常工时子表 */
export interface EquipmentDowntime {
  id: string;
  work_order_report_id: string;
  work_order_no: string;
  batch_no: string;
  anomaly_type: "设备故障" | "来料不良" | "其它原因";
  equipment_code: string;
  downtime_type: string;
  problem_description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  confirmer: string;
  created_at: string;
}

/** 制程信息子表 */
export interface ProcessInfo {
  id: string;
  work_order_report_id: string;
  work_order_no: string;
  batch_no: string;
  completion_seq: number;
  operation_seq: number;
  operation_name: string;
  material_batch_no: string;
  material_type: string;
  quantity: number;
  material_label_image: string[];
  incoming_defect_image: string[];
  process_defect_image: string[];
  created_at: string;
}

/** 报工完整快照（主表 + 子表汇总 + 工单工序列表，给详情页用） */
export interface WorkOrderReportDetail extends WorkOrderReport {
  operations: OperationReport[];
  defects: OperationDefect[];
  downtimes: EquipmentDowntime[];
  process_infos: ProcessInfo[];
  /** 工单的所有工序（来自 work_order_operations） */
  work_order_operations: WorkOrderOperation[];
}