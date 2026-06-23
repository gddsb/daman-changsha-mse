/**
 * 看板汇总数据计算（制罐业务版）
 *
 * 2026-06 改造：
 *   - 删除报工数据源（work_order_reports / operation_reports）后，
 *     "工序不良率"和"最近不良"模块不再有工序级数据源，改为返回空数组。
 *   - 质量数据统一走 quality_inspections。
 */

import { getSupabaseClient } from "@/storage/database/supabase-client";
import type {
  DashboardSummary,
  WorkOrder,
  WorkOrderStatus,
  LineStatusItem,
} from "@/types/mes";
import type { Database } from "@/storage/database/shared/types";

type WoRow = Database["public"]["Tables"]["work_orders"]["Row"];
type LineRow = Database["public"]["Tables"]["production_lines"]["Row"];
type InspRow = Database["public"]["Tables"]["quality_inspections"]["Row"];
type DefectRow = Database["public"]["Tables"]["defect_codes"]["Row"];
type PlanRow = Database["public"]["Tables"]["production_plans"]["Row"];

// 状态归一化：DB 中文 -> view 用英文枚举
const WO_STATUS_MAP: Record<string, string> = {
  计划中: "开立",
  已下发: "下发",
  生产中: "生产中",
  已暂停: "暂停",
  已完成: "完工",
  已关闭: "已关闭",
  开立: "开立",
  开工: "生产中",
  完工: "完工",
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
  const [woRes, lineRes, inspRes, defectRes, planRes] = await Promise.all([
    supa.from("work_orders").select("*"),
    supa.from("production_lines").select("*"),
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
  const inspections = (inspRes.data ?? []) as InspRow[];
  const defectCodes = (defectRes.data ?? []) as DefectRow[];
  const plans = (planRes.data ?? []) as PlanRow[];

  // === 今日产量 / 计划 ===
  const isCompleted = (s?: string | null) =>
    s === "已完成" || s === "完工" || s === "已关闭" || s === "完工";
  const todayCompletedWorkOrders = workOrders.filter(
    (w) => isCompleted(w.status) && (w.actual_end_date ?? "").slice(0, 10) === today,
  );
  const todayOutput = todayCompletedWorkOrders.reduce(
    (s, w) => s + (w.completed_quantity ?? 0),
    0,
  );
  const todayScrap = todayCompletedWorkOrders.reduce(
    (s, w) => s + (w.scrap_quantity ?? 0),
    0,
  );
  const todayPlannedQty = plans
    .filter((p) => p.plan_date === today)
    .reduce((s, p) => s + (p.planned_quantity ?? 0), 0);
  const yesterdayCompletedWorkOrders = workOrders.filter(
    (w) => isCompleted(w.status) && (w.actual_end_date ?? "").slice(0, 10) === yesterday,
  );
  const yesterdayOutput = yesterdayCompletedWorkOrders.reduce(
    (s, w) => s + (w.completed_quantity ?? 0),
    0,
  );
  const delta = todayOutput - yesterdayOutput;

  // === 产线状态 ===
  const inProgressStatuses = ["生产中"];
  const lineOrderCounts = new Map<string, number>();
  const lineActiveWorkOrders = new Map<string, WoRow[]>();
  workOrders.forEach((w) => {
    if (w.line_code && inProgressStatuses.includes(w.status ?? "")) {
      lineOrderCounts.set(w.line_code, (lineOrderCounts.get(w.line_code) ?? 0) + 1);
      const arr = lineActiveWorkOrders.get(w.line_code) ?? [];
      arr.push(w);
      lineActiveWorkOrders.set(w.line_code, arr);
    }
  });
  const inProgressByLine = new Map<string, number>();
  workOrders.forEach((w) => {
    if (w.line_code && w.status === "生产中") {
      inProgressByLine.set(w.line_code, (inProgressByLine.get(w.line_code) ?? 0) + 1);
    }
  });
  let activeLineCode: string | null = null;
  if (inProgressByLine.size > 0) {
    activeLineCode = Array.from(inProgressByLine.entries()).sort((a, b) => b[1] - a[1])[0][0];
  } else if (lineOrderCounts.size > 0) {
    const sorted = Array.from(lineOrderCounts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aEarliest = (lineActiveWorkOrders.get(a[0]) ?? [])
        .map((w) => w.actual_start_date ?? w.planned_start_date ?? "")
        .sort()[0] ?? "";
      const bEarliest = (lineActiveWorkOrders.get(b[0]) ?? [])
        .map((w) => w.actual_start_date ?? w.planned_start_date ?? "")
        .sort()[0] ?? "";
      return aEarliest.localeCompare(bEarliest);
    });
    activeLineCode = sorted[0]?.[0] ?? null;
  }
  const lineStatus: LineStatusItem[] = lines.map((l) => {
    const lineTodayCompleted = workOrders.filter(
      (w) =>
        isCompleted(w.status) &&
        (w.actual_end_date ?? "").slice(0, 10) === today &&
        w.line_code === l.code,
    );
    const lineActual = lineTodayCompleted.reduce((s, w) => s + (w.completed_quantity ?? 0), 0);
    const lineScrap = lineTodayCompleted.reduce((s, w) => s + (w.scrap_quantity ?? 0), 0);
    const lineGood = lineActual - lineScrap;
    const linePlans = plans.filter((p) => p.line_code === l.code && p.plan_date === today);
    const linePlanned = linePlans.reduce((s, p) => s + (p.planned_quantity ?? 0), 0);
    const derivedStatus = l.code === activeLineCode ? "运行" : "待机";
    return {
      code: l.code,
      name: l.name,
      status: derivedStatus,
      orderCount: lineOrderCounts.get(l.code) ?? 0,
      todayPlanned: linePlanned,
      todayActual: lineActual,
      todayScrap: lineScrap,
      todayPassRate: lineActual > 0 ? (lineGood / lineActual) * 100 : 100,
    };
  });

  // === 质量统计（取 quality_inspections 当日）===
  // 口径：按"检验次数"计算合格率（与质量检验页面一致）
  //   一次不合格 = 1 次 fail（不是 sample_size 个 fail）
  //   避免因 fail_quantity=0（种子数据/未填）导致合格率永远 100%
  const failInsp = inspections.filter((i) => i.result === "fail");
  const passInsp = inspections.filter((i) => i.result === "pass");
  const inspectedCount = inspections.length;
  const passCount = passInsp.length;
  const failCount = failInsp.length;
  const firstPassRate = inspectedCount > 0 ? (passCount / inspectedCount) * 100 : 100;
  const defectRate = inspectedCount > 0 ? (failCount / inspectedCount) * 100 : 0;

  // === 7 日产量趋势 ===
  const trendMap = new Map<string, { planned: number; actual: number; scrap: number }>();
  for (let i = 6; i >= 0; i--) {
    trendMap.set(daysAgo(i), { planned: 0, actual: 0, scrap: 0 });
  }
  workOrders.forEach((w) => {
    const s = w.status ?? "";
    if (s === "已完成" || s === "完工" || s === "已关闭") {
      const ds = (w.actual_end_date ?? w.planned_end_date ?? "").slice(0, 10);
      const entry = trendMap.get(ds);
      if (entry) {
        entry.actual += w.completed_quantity ?? 0;
        entry.scrap += w.scrap_quantity ?? 0;
      }
    }
  });
  plans.forEach((p) => {
    const entry = trendMap.get(p.plan_date);
    if (entry) {
      entry.planned += p.planned_quantity ?? 0;
    }
  });
  const outputTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
    date: date.slice(5),
    planned: v.planned,
    actual: v.actual,
    scrap: v.scrap,
  }));

  // === 进行中工单 ===
  const activeWorkOrders: WorkOrder[] = workOrders
    .filter((w) => inProgressStatuses.includes(w.status ?? ""))
    .sort((a, b) => (a.planned_start_date ?? "").localeCompare(b.planned_start_date ?? ""))
    .slice(0, 8)
    .map((w) => mapWorkOrderRow(w));

  // === 工序不良率 ===
  // 报工模块已下线，工序级不良数据无来源。保留空数组以便 UI 占位显示"暂无数据"。
  const processDefectStats: DashboardSummary["processDefectStats"] = [];

  // === 最近不良 ===
  // 改为从质量检验取最近 fail_quantity > 0 的记录
  const recentDefects: DashboardSummary["recentDefects"] = failInsp
    .slice()
    .sort((a, b) => (b.inspection_time ?? "").localeCompare(a.inspection_time ?? ""))
    .slice(0, 5)
    .map((i) => {
      const wo = workOrders.find((w) => w.id === i.work_order_id);
      return {
        id: i.id,
        work_order_no: wo?.order_no ?? "",
        product_name: i.product_name ?? "",
        process_name: i.process_name ?? "",
        line_name: i.line_name ?? "",
        defect_code: i.defect_code ?? "",
        scrap_quantity: i.fail_quantity ?? 0,
        reported_at: i.inspection_time ?? "",
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
      running: activeLineCode ? 1 : 0,
      idle: lines.length - (activeLineCode ? 1 : 0),
      maintenance: 0,
    },
    quality: {
      firstPassRate,
      inspectedCount,
      passCount,
      failCount,
      defectRate,
    },
    outputTrend,
    lineStatus,
    activeWorkOrders,
    recentDefects,
    processDefectStats,
    lastUpdated: new Date().toISOString(),
  };
}

export function mapWorkOrderRow(w: WoRow): WorkOrder {
  return {
    id: w.id,
    order_no: w.order_no,
    sales_order_no: w.sales_order_no ?? "",
    product_code: w.product_code ?? "",
    product_name: w.product_name ?? "",
    specification: w.specification ?? "",
    quantity: w.planned_quantity ?? 0,
    completed_quantity: w.completed_quantity ?? 0,
    scrap_quantity: w.scrap_quantity ?? 0,
    status: (WO_STATUS_MAP[w.status ?? ""] ?? w.status ?? "开立") as WorkOrderStatus,
    workshop: w.workshop_name ?? "",
    workshop_code: w.workshop_code ?? "",
    customer_name: w.customer_name ?? "",
    line_code: w.line_code ?? "",
    line_name: w.line_name ?? "",
    order_type: w.order_type ?? "",
    unit: w.unit ?? "罐",
    planned_start_date: w.planned_start_date ?? "",
    planned_end_date: w.planned_end_date ?? "",
    actual_start_date: w.actual_start_date ?? "",
    actual_end_date: w.actual_end_date ?? "",
    notes: w.notes ?? "",
    created_at: w.created_at ?? new Date().toISOString(),
    updated_at: w.updated_at ?? new Date().toISOString(),
  };
}

export async function getDashboardSummaryLegacy() {
  return getDashboardSummary();
}
