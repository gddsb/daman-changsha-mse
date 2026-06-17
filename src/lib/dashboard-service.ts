/**
 * 看板汇总数据计算
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";
import type { DashboardSummary, WorkOrder, WorkOrderStatus } from "@/types/mes";
import type { Database } from "@/storage/database/shared/types";

type WoRow = Database["public"]["Tables"]["work_orders"]["Row"];
type EqRow = Database["public"]["Tables"]["equipment"]["Row"];
type OeeRow = Database["public"]["Tables"]["equipment_oee"]["Row"];
type InspRow = Database["public"]["Tables"]["quality_inspections"]["Row"];
type ReportRow = Database["public"]["Tables"]["work_order_reports"]["Row"];
type DefectRow = Database["public"]["Tables"]["defect_codes"]["Row"];

// 状态归一化：DB 中文 -> view 用英文枚举
const WO_STATUS_MAP: Record<string, string> = {
  计划中: "planned",
  已下发: "released",
  生产中: "in_progress",
  已暂停: "paused",
  已完成: "completed",
  已关闭: "closed",
};

const EQ_STATUS_MAP: Record<string, string> = {
  运行中: "running",
  待机: "idle",
  维保中: "maintenance",
  故障: "breakdown",
  离线: "offline",
};

const INSP_TYPE_MAP: Record<string, string> = {
  首件检验: "first",
  巡回检验: "in_process",
  末件检验: "final",
  入库检验: "incoming",
};

const INSP_RESULT_MAP: Record<string, string> = {
  合格: "pass",
  不合格: "fail",
  让步接收: "conditional",
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
  const [woRes, eqRes, oeeRes, inspRes, reportRes, defectRes] = await Promise.all([
    supa.from("work_orders").select("*"),
    supa.from("equipment").select("*"),
    supa
      .from("equipment_oee")
      .select("*")
      .gte("record_date", day7)
      .order("record_date", { ascending: true }),
    supa
      .from("quality_inspections")
      .select("*")
      .gte("inspection_time", `${today}T00:00:00`),
    supa
      .from("work_order_reports")
      .select("*")
      .gte("reported_at", `${day7}T00:00:00`),
    supa.from("defect_codes").select("*"),
  ]);

  const workOrders = (woRes.data ?? []) as WoRow[];
  const equipment = (eqRes.data ?? []) as EqRow[];
  const oeeRows = (oeeRes.data ?? []) as OeeRow[];
  const inspections = (inspRes.data ?? []) as InspRow[];
  const reports = (reportRes.data ?? []) as ReportRow[];
  const defectCodes = (defectRes.data ?? []) as DefectRow[];

  // === 今日产量 / 计划 ===
  const todayReports = reports.filter((r) => (r.reported_at ?? "").slice(0, 10) === today);
  const todayOutput = todayReports.reduce(
    (s, r) => s + (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0),
    0,
  );
  const todayPlannedQty = workOrders
    .filter((w) => {
      const status = WO_STATUS_MAP[w.status] ?? w.status;
      return ["planned", "released", "in_progress", "paused"].includes(status);
    })
    .reduce((s, w) => s + (w.planned_quantity ?? 0), 0);
  const yesterdayOutput = reports
    .filter((r) => (r.reported_at ?? "").slice(0, 10) === yesterday)
    .reduce((s, r) => s + (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0), 0);
  const delta = todayOutput - yesterdayOutput;

  // === 设备 OEE ===
  const avgOeeList = oeeRows;
  const avgOee =
    avgOeeList.length > 0
      ? avgOeeList.reduce((s, r) => s + Number(r.oee ?? 0), 0) / avgOeeList.length
      : 0;
  const oeeToday = oeeRows.filter((r) => r.record_date === today);
  const oeeYesterday = oeeRows.filter((r) => r.record_date === yesterday);
  const oeeTodayAvg =
    oeeToday.length > 0
      ? oeeToday.reduce((s, r) => s + Number(r.oee ?? 0), 0) / oeeToday.length
      : 0;
  const oeeYesterdayAvg =
    oeeYesterday.length > 0
      ? oeeYesterday.reduce((s, r) => s + Number(r.oee ?? 0), 0) / oeeYesterday.length
      : 0;
  const availability =
    oeeToday.length > 0
      ? oeeToday.reduce((s, r) => s + Number(r.availability ?? 0), 0) / oeeToday.length
      : 0;
  const performance =
    oeeToday.length > 0
      ? oeeToday.reduce((s, r) => s + Number(r.performance ?? 0), 0) / oeeToday.length
      : 0;
  const quality =
    oeeToday.length > 0
      ? oeeToday.reduce((s, r) => s + Number(r.quality ?? 0), 0) / oeeToday.length
      : 0;

  // === 设备状态计数 ===
  const eqRunning = equipment.filter((e) => e.status === "运行中").length;
  const eqIdle = equipment.filter((e) => e.status === "待机").length;
  const eqMaint = equipment.filter((e) => e.status === "维保中").length;
  const eqBreak = equipment.filter((e) => e.status === "故障").length;

  // === 质量 ===
  const failInsp = inspections.filter((i) => i.result === "不合格");
  const firstInsp = inspections.filter((i) => INSP_TYPE_MAP[i.inspection_type] === "first");
  const firstPass = firstInsp.filter((i) => i.result === "合格").length;
  const firstPassRate = firstInsp.length > 0 ? (firstPass / firstInsp.length) * 100 : 0;
  const totalSample = inspections.reduce((s, i) => s + (i.sample_size ?? 0), 0);
  const totalFail = inspections.reduce((s, i) => s + (i.fail_quantity ?? 0), 0);
  const defectRate = totalSample > 0 ? (totalFail / totalSample) * 100 : 0;

  // === 7 日产量趋势 ===
  const trendMap = new Map<string, { planned: number; actual: number }>();
  for (let i = 6; i >= 0; i--) {
    trendMap.set(daysAgo(i), { planned: 0, actual: 0 });
  }
  reports.forEach((r) => {
    const ds = (r.reported_at ?? "").slice(0, 10);
    const entry = trendMap.get(ds);
    if (entry) {
      entry.actual += (r.good_quantity ?? 0) + (r.scrap_quantity ?? 0);
    }
  });
  // 计划值：当日所有相关工单的计划量
  workOrders.forEach((w) => {
    const start = (w.planned_start_date ?? "").slice(0, 10);
    if (trendMap.has(start)) {
      trendMap.get(start)!.planned += w.planned_quantity ?? 0;
    }
  });
  const outputTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    planned: v.planned,
    actual: v.actual,
  }));

  // === 设备矩阵 ===
  const latestOeeByCode = new Map<string, number>();
  oeeRows.forEach((r) => {
    if (!latestOeeByCode.has(r.equipment_code)) {
      latestOeeByCode.set(r.equipment_code, Number(r.oee ?? 0));
    }
  });
  const equipmentMatrix = equipment.map((e) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    status: (EQ_STATUS_MAP[e.status] ?? "idle") as "running" | "idle" | "maintenance" | "breakdown" | "offline",
    workshop: e.workshop_name,
  }));

  // === 进行中工单 ===
  const activeWorkOrders: WorkOrder[] = workOrders
    .filter((w) => ["已下发", "生产中", "已暂停"].includes(w.status))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 8)
    .map((w) => ({
      id: w.id,
      order_no: w.order_no,
      sales_order_no: w.sales_order_no,
      product_code: w.product_code,
      product_name: w.product_name,
      specification: w.specification,
      quantity: w.planned_quantity,
      completed_quantity: w.completed_quantity ?? 0,
      scrap_quantity: w.scrap_quantity ?? 0,
      status: (WO_STATUS_MAP[w.status] ?? w.status) as WorkOrderStatus,
      priority: (w.priority ?? 3) as 1 | 2 | 3 | 4 | 5,
      workshop: w.workshop_name,
      workshop_code: w.workshop_code,
      customer_name: w.customer_name,
      planned_start_date: w.planned_start_date,
      planned_end_date: w.planned_end_date,
      actual_start_date: w.actual_start_date,
      actual_end_date: w.actual_end_date,
      notes: w.notes,
      created_at: w.created_at,
      updated_at: w.updated_at,
    }));

  // === 最近不良 ===
  const recentDefects = failInsp
    .sort((a, b) => (b.inspection_time ?? "").localeCompare(a.inspection_time ?? ""))
    .slice(0, 5)
    .map((i) => {
      const dc = defectCodes.find((d) => d.code === i.defect_code);
      return {
        id: i.id,
        inspection_no: i.inspection_no,
        product_name: i.product_name,
        defect_code: i.defect_code,
        defect_description: dc?.name ?? i.defect_description,
        inspection_time: i.inspection_time,
      };
    });

  return {
    today: {
      plannedQty: todayPlannedQty,
      completedQty: todayOutput,
      completionRate: todayPlannedQty > 0 ? (todayOutput / todayPlannedQty) * 100 : 0,
      delta,
    },
    equipment: {
      total: equipment.length,
      running: eqRunning,
      idle: eqIdle,
      maintenance: eqMaint,
      breakdown: eqBreak,
      availability,
      performance,
      quality,
      oee: oeeTodayAvg || avgOee,
    },
    quality: {
      firstPassRate,
      inspectionCount: inspections.length,
      defectCount: totalFail,
      defectRate,
    },
    outputTrend,
    equipmentMatrix,
    activeWorkOrders,
    recentDefects,
  };
}

export async function getDashboardSummaryLegacy() {
  return getDashboardSummary();
}
