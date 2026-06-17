/**
 * 看板汇总数据计算（制罐业务版）
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";
import type {
  DashboardSummary,
  WorkOrder,
  WorkOrderStatus,
  LineStatusItem,
  ProcessDefectStat,
} from "@/types/mes";
import type { Database } from "@/storage/database/shared/types";

type WoRow = Database["public"]["Tables"]["work_orders"]["Row"];
type LineRow = Database["public"]["Tables"]["production_lines"]["Row"];
type ReportRow = Database["public"]["Tables"]["work_order_reports"]["Row"];
type InspRow = Database["public"]["Tables"]["quality_inspections"]["Row"];
type DefectRow = Database["public"]["Tables"]["defect_codes"]["Row"];
type PlanRow = Database["public"]["Tables"]["production_plans"]["Row"];

// 状态归一化：DB 中文 -> view 用英文枚举
const WO_STATUS_MAP: Record<string, string> = {
  计划中: "planned",
  已下发: "released",
  生产中: "in_progress",
  已暂停: "paused",
  已完成: "completed",
  已关闭: "closed",
  开立: "planned",
  开工: "in_progress",
  完工: "completed",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supa = getSupabaseClient();
  const today = todayStr();
  const day7 = daysAgo(6);
  const yesterday = daysAgo(1);

  // 并行拉取基础数据
  const [woRes, lineRes, reportRes, inspRes, defectRes, planRes] = await Promise.all([
    supa.from("work_orders").select("*"),
    supa.from("production_lines").select("*"),
    supa
      .from("work_order_reports")
      .select("*")
      .gte("reported_at", `${day7}T00:00:00`),
    supa
      .from("quality_inspections")
      .select("*")
      .gte("inspection_time", `${today}T00:00:00`),
    supa.from("defect_codes").select("*"),
    supa
      .from("production_plans")
      .select("*")
      .gte("plan_date", today)
      .lte("plan_date", daysAgo(-6)),
  ]);

  const workOrders = (woRes.data ?? []) as WoRow[];
  const lines = (lineRes.data ?? []) as LineRow[];
  const reports = (reportRes.data ?? []) as ReportRow[];
  const inspections = (inspRes.data ?? []) as InspRow[];
  const defectCodes = (defectRes.data ?? []) as DefectRow[];
  const plans = (planRes.data ?? []) as PlanRow[];

  // === 今日产量 / 计划 ===
  const todayReports = reports.filter((r) => (r.reported_at ?? "").slice(0, 10) === today);
  const todayOutput = todayReports.reduce(
    (s, r) => s + (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0),
    0,
  );
  const todayScrap = todayReports.reduce((s, r) => s + (r.scrap_quantity ?? 0), 0);
  const todayPlannedQty = plans
    .filter((p) => p.plan_date === today)
    .reduce((s, p) => s + (p.planned_quantity ?? 0), 0);
  const yesterdayOutput = reports
    .filter((r) => (r.reported_at ?? "").slice(0, 10) === yesterday)
    .reduce((s, r) => s + (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0), 0);
  const delta = todayOutput - yesterdayOutput;

  // === 产线状态 ===
  const lineStatus: LineStatusItem[] = lines.map((l) => {
    const lineReports = todayReports.filter((r) => r.line_code === l.code);
    const lineActual = lineReports.reduce(
      (s, r) => s + (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0),
      0,
    );
    const lineScrap = lineReports.reduce((s, r) => s + (r.scrap_quantity ?? 0), 0);
    const lineGood = lineReports.reduce((s, r) => s + (r.good_quantity ?? 0), 0);
    const linePlans = plans.filter((p) => p.line_code === l.code && p.plan_date === today);
    const linePlanned = linePlans.reduce((s, p) => s + (p.planned_quantity ?? 0), 0);
    const lineOrderCount = workOrders.filter(
      (w) => w.line_code === l.code && ["已下发", "生产中", "已暂停", "开工", "开立"].includes(w.status),
    ).length;
    return {
      code: l.code,
      name: l.name,
      status: l.status,
      orderCount: lineOrderCount,
      todayPlanned: linePlanned,
      todayActual: lineActual,
      todayScrap: lineScrap,
      todayPassRate: lineActual > 0 ? (lineGood / lineActual) * 100 : 100,
    };
  });

  // === 质量统计 ===
  const failInsp = inspections.filter((i) => i.result === "不合格");
  const totalSample = inspections.reduce((s, i) => s + (i.sample_size ?? 0), 0);
  const totalFail = inspections.reduce((s, i) => s + (i.fail_quantity ?? 0), 0);
  const totalPass = totalSample - totalFail;
  const firstPassRate = totalSample > 0 ? (totalPass / totalSample) * 100 : 100;
  const defectRate = totalSample > 0 ? (totalFail / totalSample) * 100 : 0;

  // === 7 日产量趋势 ===
  const trendMap = new Map<string, { planned: number; actual: number; scrap: number }>();
  for (let i = 6; i >= 0; i--) {
    trendMap.set(daysAgo(i), { planned: 0, actual: 0, scrap: 0 });
  }
  reports.forEach((r) => {
    const ds = (r.reported_at ?? "").slice(0, 10);
    const entry = trendMap.get(ds);
    if (entry) {
      entry.actual += (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0);
      entry.scrap += r.scrap_quantity ?? 0;
    }
  });
  plans.forEach((p) => {
    const entry = trendMap.get(p.plan_date);
    if (entry) {
      entry.planned += p.planned_quantity ?? 0;
    }
  });
  const outputTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    planned: v.planned,
    actual: v.actual,
    scrap: v.scrap,
  }));

  // === 进行中工单 ===
  const activeWorkOrders: WorkOrder[] = workOrders
    .filter((w) => ["已下发", "生产中", "已暂停", "开工"].includes(w.status))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 8)
    .map((w) => mapWorkOrderRow(w));

  // === 工序不良率 ===
  const processMap = new Map<string, { inspected: number; scrap: number }>();
  reports.forEach((r) => {
    const process = r.process_name ?? "其他";
    const entry = processMap.get(process) ?? { inspected: 0, scrap: 0 };
    entry.inspected += (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0);
    entry.scrap += r.scrap_quantity ?? 0;
    processMap.set(process, entry);
  });
  const processDefectStats: ProcessDefectStat[] = Array.from(processMap.entries())
    .map(([process, v]) => ({
      process,
      inspected: v.inspected,
      scrap: v.scrap,
      scrapRate: v.inspected > 0 ? (v.scrap / v.inspected) * 100 : 0,
    }))
    .sort((a, b) => b.scrapRate - a.scrapRate);

  // === 最近不良 ===
  const recentDefects = reports
    .filter((r) => (r.scrap_quantity ?? 0) > 0)
    .sort((a, b) => (b.reported_at ?? "").localeCompare(a.reported_at ?? ""))
    .slice(0, 5)
    .map((r) => {
      const dc = defectCodes.find((d) => d.code === r.scrap_reason);
      return {
        id: r.id,
        work_order_no: r.work_order_no,
        product_name: r.product_name ?? "",
        process_name: r.process_name,
        line_name: r.line_name,
        defect_code: r.scrap_reason,
        scrap_quantity: r.scrap_quantity ?? 0,
        reported_at: r.reported_at,
      };
    });

  return {
    today: {
      plannedQty: todayPlannedQty,
      completedQty: todayOutput,
      completionRate: todayPlannedQty > 0 ? (todayOutput / todayPlannedQty) * 100 : 0,
      delta,
    },
    lines: {
      total: lines.length,
      running: lineStatus.filter((l) => l.status === "运行").length,
      idle: lineStatus.filter((l) => l.status === "停机").length,
      maintenance: lineStatus.filter((l) => l.status === "维保").length,
    },
    quality: {
      firstPassRate,
      inspectedCount: inspections.length,
      defectCount: todayScrap,
      defectRate,
    },
    outputTrend,
    lineStatus,
    activeWorkOrders,
    recentDefects,
    processDefectStats,
  };
}

export function mapWorkOrderRow(w: WoRow): WorkOrder {
  return {
    id: w.id,
    order_no: w.order_no,
    sales_order_no: w.sales_order_no,
    product_code: w.product_code ?? "",
    product_name: w.product_name ?? "",
    specification: w.specification,
    quantity: w.planned_quantity ?? 0,
    completed_quantity: w.completed_quantity ?? 0,
    scrap_quantity: w.scrap_quantity ?? 0,
    status: (WO_STATUS_MAP[w.status ?? ""] ?? w.status ?? "planned") as WorkOrderStatus,
    priority: (w.priority ?? 3) as 1 | 2 | 3 | 4 | 5,
    workshop: w.workshop_name,
    workshop_code: w.workshop_code,
    customer_name: w.customer_name,
    line_code: w.line_code,
    line_name: w.line_name,
    order_type: w.order_type,
    unit: w.unit,
    planned_start_date: w.planned_start_date,
    planned_end_date: w.planned_end_date,
    actual_start_date: w.actual_start_date,
    actual_end_date: w.actual_end_date,
    notes: w.notes,
    created_at: w.created_at ?? new Date().toISOString(),
    updated_at: w.updated_at ?? new Date().toISOString(),
  };
}

export async function getDashboardSummaryLegacy() {
  return getDashboardSummary();
}
