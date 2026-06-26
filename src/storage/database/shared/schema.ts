import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ============================================================
 * 字典 / 基础数据
 * ============================================================ */

export const workshops = pgTable("workshops", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 制罐行业：每个车间下有若干条生产线（A/B 线）
export const productionLines = pgTable("production_lines", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  workshopCode: varchar("workshop_code", { length: 32 }).notNull(),
  workshopName: varchar("workshop_name", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("运行"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  specification: text("specification"),
  unit: varchar("unit", { length: 16 }),
  processRoute: text("process_route"),
  source: varchar("source", { length: 16 }).notNull().default("manual"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const u9SalesOrders = pgTable("u9_sales_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  salesOrderNo: varchar("sales_order_no", { length: 64 }).notNull().unique(),
  customerCode: varchar("customer_code", { length: 64 }),
  customerName: varchar("customer_name", { length: 128 }).notNull(),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 128 }).notNull(),
  specification: text("specification"),
  quantity: integer("quantity").notNull(),
  unit: varchar("unit", { length: 16 }),
  deliveryDate: date("delivery_date"),
  status: varchar("status", { length: 32 }).notNull().default("待发货"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

/* ============================================================
 * 工单管理（制罐）
 * ============================================================ */

export const workOrders = pgTable("work_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  orderNo: varchar("order_no", { length: 64 }).notNull().unique(),
  orderType: varchar("order_type", { length: 32 }).notNull().default("制罐生产订单"),
  salesOrderNo: varchar("sales_order_no", { length: 64 }),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 128 }).notNull(),
  specification: varchar("specification", { length: 256 }),
  unit: varchar("unit", { length: 16 }).notNull().default("罐"),
  plannedQuantity: integer("planned_quantity").notNull(),
  completedQuantity: integer("completed_quantity").notNull().default(0),
  scrapQuantity: integer("scrap_quantity").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("计划中"),
  workshopCode: varchar("workshop_code", { length: 32 }),
  workshopName: varchar("workshop_name", { length: 64 }),
  lineCode: varchar("line_code", { length: 32 }),
  lineName: varchar("line_name", { length: 64 }),
  customerName: varchar("customer_name", { length: 128 }),
  plannedStartDate: timestamp("planned_start_date", { withTimezone: true }),
  plannedEndDate: timestamp("planned_end_date", { withTimezone: true }),
  actualStartDate: timestamp("actual_start_date", { withTimezone: true }),
  actualEndDate: timestamp("actual_end_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 13 道固定连续工序（每个工单生成 13 条）
 * 1-下料 2-小料检测 3-焊接 4-补图烘干 5-封口 6-测漏
 * 7-离子风 8-卷封光检 9-倒罐光检 10-罐内光检 11-全检 12-码垛 13-包装
 */
export const workOrderOperations = pgTable("work_order_operations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull(),
  sequence: integer("sequence").notNull(),
  operationName: varchar("operation_name", { length: 64 }).notNull(),
  workstation: varchar("workstation", { length: 64 }),
  lineCode: varchar("line_code", { length: 32 }),
  lineName: varchar("line_name", { length: 64 }),
  equipmentCode: varchar("equipment_code", { length: 32 }),
  standardTimeMinutes: integer("standard_time_minutes"),
  status: varchar("status", { length: 32 }).notNull().default("待开始"),
  operatorName: varchar("operator_name", { length: 64 }),
  goodQuantity: integer("good_quantity").notNull().default(0),
  scrapQuantity: integer("scrap_quantity").notNull().default(0),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
});


/* ============================================================
 * 生产计划（七天滚动）
 * ============================================================ */

export const productionPlans = pgTable("production_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  planDate: date("plan_date").notNull(),
  lineCode: varchar("line_code", { length: 32 }).notNull(),
  lineName: varchar("line_name", { length: 64 }).notNull(),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull(),
  workOrderNo: varchar("work_order_no", { length: 64 }).notNull(),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 128 }).notNull(),
  plannedQuantity: integer("planned_quantity").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("已排"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* ============================================================
 * 设备管理（保留兼容）
 * ============================================================ */

export const equipment = pgTable("equipment", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  model: varchar("model", { length: 64 }),
  manufacturer: varchar("manufacturer", { length: 64 }),
  workshopCode: varchar("workshop_code", { length: 32 }),
  workshopName: varchar("workshop_name", { length: 64 }),
  lineCode: varchar("line_code", { length: 32 }),
  lineName: varchar("line_name", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("待机"),
  currentWorkOrderNo: varchar("current_work_order_no", { length: 64 }),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  oeeTarget: numeric("oee_target", { precision: 5, scale: 2 }).default("85.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const equipmentOee = pgTable(
  "equipment_oee",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    equipmentCode: varchar("equipment_code", { length: 32 }).notNull(),
    recordDate: date("record_date").notNull(),
    plannedTimeMinutes: integer("planned_time_minutes").notNull().default(480),
    runTimeMinutes: integer("run_time_minutes").notNull().default(0),
    downtimeMinutes: integer("downtime_minutes").notNull().default(0),
    goodQuantity: integer("good_quantity").notNull().default(0),
    totalQuantity: integer("total_quantity").notNull().default(0),
    availability: numeric("availability", { precision: 5, scale: 2 }).default("0"),
    performance: numeric("performance", { precision: 5, scale: 2 }).default("0"),
    quality: numeric("quality", { precision: 5, scale: 2 }).default("0"),
    oee: numeric("oee", { precision: 5, scale: 2 }).default("0"),
  },
  (t) => ({
    eqDateIdx: uniqueIndex("equipment_oee_eq_date_unique").on(
      t.equipmentCode,
      t.recordDate
    ),
  })
);

export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  equipmentCode: varchar("equipment_code", { length: 32 }).notNull(),
  equipmentName: varchar("equipment_name", { length: 64 }).notNull(),
  maintenanceType: varchar("maintenance_type", { length: 32 }).notNull(),
  plannedDate: date("planned_date").notNull(),
  completedDate: date("completed_date"),
  operatorName: varchar("operator_name", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("待执行"),
  description: text("description"),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  notes: text("notes"),
});

/* ============================================================
 * 质量管理（含日报维度字段）
 * ============================================================ */

export const defectCodes = pgTable("defect_codes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull().default("一般"),
});

export const qualityInspections = pgTable("quality_inspections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  inspectionNo: varchar("inspection_no", { length: 64 }).notNull().unique(),
  workOrderId: varchar("work_order_id", { length: 36 }),
  workOrderNo: varchar("work_order_no", { length: 64 }),
  inspectionType: varchar("inspection_type", { length: 32 }).notNull(),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 128 }).notNull(),
  canSpec: varchar("can_spec", { length: 64 }),
  canHeight: integer("can_height"),
  batchNo: varchar("batch_no", { length: 64 }),
  processName: varchar("process_name", { length: 64 }),
  lineCode: varchar("line_code", { length: 32 }),
  lineName: varchar("line_name", { length: 64 }),
  shiftNo: varchar("shift_no", { length: 16 }).default("白班"),
  inspectorName: varchar("inspector_name", { length: 64 }).notNull(),
  inspectionTime: timestamp("inspection_time", { withTimezone: true }).defaultNow(),
  sampleSize: integer("sample_size").notNull().default(1),
  result: varchar("result", { length: 32 }).notNull().default("合格"),
  defectCode: varchar("defect_code", { length: 32 }),
  defectDescription: text("defect_description"),
  measurements: jsonb("measurements"),
  notes: text("notes"),
});

/* ============================================================
 * 质量日报（按日期/线/产品/工序聚合，可从 work_order_reports 实时计算，也可落库）
 * ============================================================ */

export const dailyQualityReports = pgTable("daily_quality_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  reportDate: date("report_date").notNull(),
  lineCode: varchar("line_code", { length: 32 }).notNull(),
  lineName: varchar("line_name", { length: 64 }).notNull(),
  processName: varchar("process_name", { length: 64 }).notNull(),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 128 }).notNull(),
  canSpec: varchar("can_spec", { length: 64 }),
  canHeight: integer("can_height"),
  shiftNo: varchar("shift_no", { length: 16 }).default("白班"),
  totalInspected: integer("total_inspected").notNull().default(0),
  totalGood: integer("total_good").notNull().default(0),
  totalScrap: integer("total_scrap").notNull().default(0),
  passRate: numeric("pass_rate", { precision: 5, scale: 4 }).default("0"),
  scrapRate: numeric("scrap_rate", { precision: 5, scale: 4 }).default("0"),
  defectBreakdown: jsonb("defect_breakdown"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* ============================================================
 * 系统
 * ============================================================ */

export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

/* ============================================================
 * 报工管理（5 张表）
 *   - work_order_reports  工单报工主表
 *   - operation_reports   工序报工子表
 *   - operation_defects   工序不良子表
 *   - equipment_downtime  异常工时子表
 *   - process_infos       制程信息子表
 * ============================================================ */

export const workOrderReports = pgTable("work_order_reports", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()::text`),
  reportNo: varchar("report_no", { length: 32 }),
  workOrderId: varchar("work_order_id", { length: 64 }).notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  workOrderNo: varchar("work_order_no", { length: 32 }).notNull(),
  completionSeq: integer("completion_seq").notNull().default(1),
  batchNo: varchar("batch_no", { length: 32 }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  skilledWorkerCount: integer("skilled_worker_count").default(0),
  regularWorkerCount: integer("regular_worker_count").default(0),
  contractWorkerCount: integer("contract_worker_count").default(0),
  otherWorkerCount: integer("other_worker_count").default(0),
  inputQuantity: integer("input_quantity").default(0),
  passQuantity: integer("pass_quantity").default(0),
  failQuantity: integer("fail_quantity").default(0),
  isClosed: integer("is_closed").default(0),
  closeType: varchar("close_type", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("uniq_wo_reports_wo_seq").on(t.workOrderId, t.completionSeq),
}));

export const operationReports = pgTable("operation_reports", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()::text`),
  workOrderReportId: varchar("work_order_report_id", { length: 64 }).notNull().references(() => workOrderReports.id, { onDelete: "cascade" }),
  workOrderNo: varchar("work_order_no", { length: 32 }).notNull(),
  batchNo: varchar("batch_no", { length: 32 }).notNull(),
  operationSeq: integer("operation_seq").notNull(),
  operationName: varchar("operation_name", { length: 64 }).notNull(),
  inputQuantity: integer("input_quantity").default(0),
  passQuantity: integer("pass_quantity").default(0),
  failQuantity: integer("fail_quantity").default(0),
  reportTime: timestamp("report_time", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("uniq_op_reports_wo_rep_seq").on(t.workOrderReportId, t.operationSeq),
}));

export const operationDefects = pgTable("operation_defects", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()::text`),
  operationReportId: varchar("operation_report_id", { length: 64 }).references(() => operationReports.id, { onDelete: "cascade" }),
  workOrderReportId: varchar("work_order_report_id", { length: 64 }).notNull().references(() => workOrderReports.id, { onDelete: "cascade" }),
  workOrderNo: varchar("work_order_no", { length: 32 }).notNull(),
  batchNo: varchar("batch_no", { length: 32 }).notNull(),
  operationSeq: integer("operation_seq"),
  operationName: varchar("operation_name", { length: 64 }),
  defectCategory: varchar("defect_category", { length: 32 }).notNull(),
  defectName: varchar("defect_name", { length: 64 }).notNull(),
  defectQuantity: integer("defect_quantity").default(0),
  unit: varchar("unit", { length: 16 }),
  images: jsonb("images").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const equipmentDowntime = pgTable("equipment_downtime", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()::text`),
  workOrderReportId: varchar("work_order_report_id", { length: 64 }).notNull().references(() => workOrderReports.id, { onDelete: "cascade" }),
  workOrderNo: varchar("work_order_no", { length: 32 }).notNull(),
  batchNo: varchar("batch_no", { length: 32 }).notNull(),
  anomalyType: varchar("anomaly_type", { length: 32 }).notNull(),
  equipmentCode: varchar("equipment_code", { length: 32 }),
  downtimeType: varchar("downtime_type", { length: 32 }),
  problemDescription: text("problem_description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").default(0),
  confirmer: varchar("confirmer", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const processInfos = pgTable("process_infos", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()::text`),
  workOrderReportId: varchar("work_order_report_id", { length: 64 }).notNull().references(() => workOrderReports.id, { onDelete: "cascade" }),
  workOrderNo: varchar("work_order_no", { length: 32 }).notNull(),
  batchNo: varchar("batch_no", { length: 32 }).notNull(),
  completionSeq: integer("completion_seq").notNull(),
  operationSeq: integer("operation_seq").notNull(),
  operationName: varchar("operation_name", { length: 64 }),
  materialBatchNo: varchar("material_batch_no", { length: 64 }),
  materialType: varchar("material_type", { length: 64 }),
  quantity: integer("quantity").default(0),
  materialLabelImage: jsonb("material_label_image").$type<string[]>(),
  incomingDefectImage: jsonb("incoming_defect_image").$type<string[]>(),
  processDefectImage: jsonb("process_defect_image").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
