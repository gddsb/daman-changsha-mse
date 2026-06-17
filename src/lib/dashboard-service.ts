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
type OpReportRow = Database["public"]["Tables"]["operation_reports"]["Row"];
type WoReportRow = Database["public"]["Tables"]["work_order_reports"]["Row"];

// operation_reports 不存 work_order_id，需要从 work_order_reports 间接查找
// 返回 opReport 对应的 work_order_id；查不到时返回 ""
function woIdFromOpReport(r: OpReportRow, woReports: WoReportRow[]): string {
  const wr = woReports.find((x) => x.id === r.work_order_report_id);
  return wr ? String(wr.work_order_id ?? "") : "";
}
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
  const [woRes, lineRes, opRes, wrRes, inspRes, defectRes, planRes] = await Promise.all([
    supa.from("work_orders").select("*"),
    supa.from("production_lines").select("*"),
    supa
      .from("operation_reports")
      .select("*")
      .gte("created_at", `${day7}T00:00:00`),
    supa
      .from("work_order_reports")
      .select("*")
      .gte("created_at", `${day7}T00:00:00`),
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
  const opReports = (opRes.data ?? []) as OpReportRow[];
  const woReports = (wrRes.data ?? []) as WoReportRow[];
  const inspections = (inspRes.data ?? []) as InspRow[];
  const defectCodes = (defectRes.data ?? []) as DefectRow[];
  const plans = (planRes.data ?? []) as PlanRow[];

  // === 今日产量 / 计划 ===
  // 今日完工数 = 今日完工的工单的 completed_quantity 累加
  // 不再按工序报工累加（一批罐会经 13 道工序，会被算 13 次）
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
  // 规则：制罐产线一次只能跑一条产线。当前"在制"工单数最多的产线标记为"运行"，
  // 其余为"待机"；无任何在制工单时全部为"待机"。
  // 排序键：在制工单数（降序）→ 最早开工时间（升序）→ 优先级（升序）
  // 用户要求：在制工单仅显示"生产中"；
  // "暂停/开立" 不视为在制（产线仍按规则显示，但不在列表中列出）。
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
  // 选出唯一一条"当前运行"产线
  // 优先级：今日有 in_progress 工单（实际在跑）的产线 > 今日有完工产量的产线
  //        > 在制工单数最多 > 最早开工
  let activeLineCode: string | null = null;
  const inProgressByLine = new Map<string, number>();
  workOrders.forEach((w) => {
    if (w.line_code && w.status === "生产中") {
      inProgressByLine.set(w.line_code, (inProgressByLine.get(w.line_code) ?? 0) + 1);
    }
  });
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
    // 动态产线状态：制罐产线一次只能跑一条，所以只有 activeLineCode 是"运行"
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

  // === 质量统计 ===
  const failInsp = inspections.filter((i) => i.result === "不合格");
  const totalSample = inspections.reduce((s, i) => s + (i.sample_size ?? 0), 0);
  const totalFail = inspections.reduce((s, i) => s + (i.fail_quantity ?? 0), 0);
  const totalPass = totalSample - totalFail;
  const firstPassRate = totalSample > 0 ? (totalPass / totalSample) * 100 : 100;
  const defectRate = totalSample > 0 ? (totalFail / totalSample) * 100 : 0;

  // === 7 日产量趋势 ===
  // 完工数 = 工单 completed_quantity（按 actual_end_date 分桶）
  // 这样能避免按每道工序报工累加导致的重复计算（一批罐经 13 道工序会被算 13 次）
  const trendMap = new Map<string, { planned: number; actual: number; scrap: number }>();
  for (let i = 6; i >= 0; i--) {
    trendMap.set(daysAgo(i), { planned: 0, actual: 0, scrap: 0 });
  }
  workOrders.forEach((w) => {
    const s = w.status ?? "";
    if (s === "已完成" || s === "完工" || s === "已关闭" || s === "完工") {
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
    date: date.slice(5), // MM-DD
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

  // === 工序不良率（今日 / 昨日 / 本月 三列）===
  // 数据源：operation_reports（工序报工）
  const CAN_PROCESS_NAMES = [
    "下料","小料检测","焊接","补图烘干","封口","测漏","离子风",
    "卷封光检","倒罐光检","罐内光检","全检","码垛","包装",
  ];
  // 收集 opReports 中所有报工日期，按降序去重；若无数据则退回到 today
  const reportDays = Array.from(
    new Set(opReports.map((r) => (r.created_at ?? "").slice(0, 10)).filter(Boolean)),
  ).sort((a, b) => b.localeCompare(a));
  const latestDay = reportDays[0] ?? today;
  const prevDay = reportDays[1] ?? latestDay;
  const monthPrefix = today.slice(0, 7); // YYYY-MM

  const procMaps = {
    today: new Map<string, { inspected: number; scrap: number }>(),
    yesterday: new Map<string, { inspected: number; scrap: number }>(),
    month: new Map<string, { inspected: number; scrap: number }>(),
  };
  opReports.forEach((r) => {
    const proc = r.process_name ?? "其他";
    const rDate = (r.created_at ?? "").substring(0, 10);
    const ins = (r.input_qty ?? 0);
    const sc = r.defect_qty ?? 0;
    if (rDate === latestDay) {
      const e = procMaps.today.get(proc) ?? { inspected: 0, scrap: 0 };
      e.inspected += ins; e.scrap += sc; procMaps.today.set(proc, e);
    }
    if (rDate === prevDay) {
      const e = procMaps.yesterday.get(proc) ?? { inspected: 0, scrap: 0 };
      e.inspected += ins; e.scrap += sc; procMaps.yesterday.set(proc, e);
    }
    if (rDate.startsWith(monthPrefix)) {
      const e = procMaps.month.get(proc) ?? { inspected: 0, scrap: 0 };
      e.inspected += ins; e.scrap += sc; procMaps.month.set(proc, e);
    }
  });
  const makeBucket = (v: { inspected: number; scrap: number } | undefined) => ({
    inspected: v?.inspected ?? 0,
    scrap: v?.scrap ?? 0,
    scrapRate: v && v.inspected > 0 ? (v.scrap / v.inspected) * 100 : 0,
  });
  // 行 = 13 道固定工序（即便无数据也占位显示 0.00%）
  const processDefectStats: ProcessDefectStat[] = CAN_PROCESS_NAMES
    .map((proc) => ({
      process: proc,
      today: makeBucket(procMaps.today.get(proc)),
      yesterday: makeBucket(procMaps.yesterday.get(proc)),
      month: makeBucket(procMaps.month.get(proc)),
    }))
    // 排序：按今日不良率降序（无数据排后）
    .sort((a, b) => b.today.scrapRate - a.today.scrapRate);

  // === 最近不良 ===
  const recentDefects = opReports
    .filter((r) => (r.defect_qty ?? 0) > 0)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5)
    .map((r) => {
      const wo = workOrders.find((w) => w.id === woIdFromOpReport(r, woReports));
      return {
        id: r.id,
        work_order_no: wo?.order_no ?? "",
        product_name: wo?.product_name ?? "",
        process_name: r.process_name,
        line_name: "",
        defect_code: r.notes,
        scrap_quantity: r.defect_qty ?? 0,
        reported_at: r.created_at,
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
    status: (WO_STATUS_MAP[w.status ?? ""] ?? w.status ?? "开立") as WorkOrderStatus,
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
