/**
 * 长沙大满生产管理系统 - 种子数据脚本
 * - 1 个车间（制罐车间）
 * - 2 条产线（A/B）
 * - 13 道连续工序（下料→小料检测→焊接→补图烘干→封口→测漏→离子风→卷封光检→倒罐光检→罐内光检→全检→码垛→包装）
 * - 7 天滚动生产计划
 * - 质量日报自动聚合
 *
 * 执行：npx tsx scripts/seed-mes.ts
 */

import * as fs from "fs";
import * as path from "path";
import { getSupabaseClient } from "../src/storage/database/supabase-client";

const db = () => getSupabaseClient();

const PROCESS_ROUTE = [
  "下料",
  "小料检测",
  "焊接",
  "补图烘干",
  "封口",
  "测漏",
  "离子风",
  "卷封光检",
  "倒罐光检",
  "罐内光检",
  "全检",
  "码垛",
  "包装",
];

const STATUS_MAP: Record<string, string> = {
  完工: "completed",
  开工: "in_progress",
  开立: "released",
  关闭: "closed",
  挂起: "paused",
};

function nowIso(): string {
  return new Date().toISOString();
}

function daysFromToday(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d.toISOString();
}

function daysFromTodayDate(days: number): string {
  return daysFromToday(days).slice(0, 10);
}

async function truncate() {
  const client = db();
  const tables = [
    "daily_quality_reports",
    "production_plans",
    "work_order_reports",
    "work_order_operations",
    "quality_inspections",
    "work_orders",
    "equipment_maintenance",
    "equipment_oee",
    "equipment",
    "u9_sales_orders",
    "products",
    "production_lines",
    "workshops",
    "defect_codes",
  ];
  for (const t of tables) {
    const { error } = await client.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.error(`清理表 ${t} 失败:`, error.message);
    }
  }
  console.log("已清空业务表");
}

async function seedFoundation() {
  const client = db();
  // 1 个车间
  const { error: wsErr } = await client.from("workshops").insert({
    code: "WS-CN",
    name: "制罐车间",
    description: "易拉盖/奶粉罐自动流水线生产车间",
  });
  if (wsErr) console.error("车间:", wsErr.message);

  // 2 条产线
  const { error: lineErr } = await client.from("production_lines").insert([
    {
      code: "LINE-A",
      name: "A线",
      workshop_code: "WS-CN",
      workshop_name: "制罐车间",
      status: "运行",
      description: "高速自动流水线（12000 罐/班）",
    },
    {
      code: "LINE-B",
      name: "B线",
      workshop_code: "WS-CN",
      workshop_name: "制罐车间",
      status: "运行",
      description: "高速自动流水线（10000 罐/班）",
    },
  ]);
  if (lineErr) console.error("产线:", lineErr.message);

  // 不良代码字典（按 13 工序分类）
  const defects = [
    { code: "D-CUT-01", name: "切边不齐", category: "下料", severity: "一般" },
    { code: "D-CUT-02", name: "毛刺", category: "下料", severity: "轻微" },
    { code: "D-WLD-01", name: "虚焊", category: "焊接", severity: "严重" },
    { code: "D-WLD-02", name: "焊穿", category: "焊接", severity: "严重" },
    { code: "D-DRY-01", name: "补图偏移", category: "补图烘干", severity: "一般" },
    { code: "D-SEAL-01", name: "封口不平", category: "封口", severity: "一般" },
    { code: "D-LK-01", name: "测漏不合格", category: "测漏", severity: "严重" },
    { code: "D-OPT-01", name: "卷封划痕", category: "卷封光检", severity: "一般" },
    { code: "D-OPT-02", name: "罐内异物", category: "罐内光检", severity: "严重" },
    { code: "D-FULL-01", name: "外观缺陷", category: "全检", severity: "一般" },
    { code: "D-PKG-01", name: "码垛错位", category: "码垛", severity: "轻微" },
  ];
  const { error: defErr } = await client.from("defect_codes").insert(defects);
  if (defErr) console.error("不良代码:", defErr.message);

  console.log("✓ 基础数据：1 车间 + 2 产线 + 11 不良代码");
}

/**
 * 模拟生产订单（10 条）
 * - 5 种罐型（400g/700g/800g/900g/标准）
 * - A/B 两条线交替分配
 * - 状态分布：3 已开工 + 2 完工 + 2 已下发 + 2 开工中 + 1 暂停
 * - 计划时间分布在未来 7 天
 */
const SIMULATED_ORDERS: Array<{
  order_no: string;
  product_code: string;
  product_name: string;
  spec: string;
  quantity: number;
  status: "released" | "in_progress" | "completed" | "paused";
  start_offset_days: number;
  end_offset_days: number;
  order_type: string;
  priority: number;
}> = [
  { order_no: "MO-DEMO-0001", product_code: "C05-400-001", product_name: "卓徉400g婴儿配方奶粉罐", spec: "400g", quantity: 8500, status: "in_progress", start_offset_days: -1, end_offset_days: 1, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0002", product_code: "C05-700-002", product_name: "合生元700g较大婴儿配方羊奶粉罐", spec: "700g", quantity: 6200, status: "in_progress", start_offset_days: 0, end_offset_days: 2, order_type: "制罐生产订单", priority: 2 },
  { order_no: "MO-DEMO-0003", product_code: "C05-800-003", product_name: "爱他美卓徉800g幼儿配方奶粉罐", spec: "800g", quantity: 11200, status: "completed", start_offset_days: -3, end_offset_days: -1, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0004", product_code: "C05-400-004", product_name: "佳贝艾特400g儿童成长奶粉罐", spec: "400g", quantity: 4300, status: "released", start_offset_days: 1, end_offset_days: 3, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0005", product_code: "C05-900-005", product_name: "草牧里900g后生元驼乳粉罐", spec: "900g", quantity: 5400, status: "released", start_offset_days: 2, end_offset_days: 4, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0006", product_code: "C05-700-006", product_name: "飞鹤星飞帆700g较大婴儿配方奶粉罐", spec: "700g", quantity: 7800, status: "in_progress", start_offset_days: -1, end_offset_days: 2, order_type: "制罐生产订单", priority: 2 },
  { order_no: "MO-DEMO-0007", product_code: "C05-STD-007", product_name: "合生元可贝思亲呵标准罐（200g辅食罐）", spec: "标准", quantity: 3200, status: "paused", start_offset_days: 0, end_offset_days: 3, order_type: "制罐生产订单", priority: 4 },
  { order_no: "MO-DEMO-0008", product_code: "C05-800-008", product_name: "伊利金领冠800g菁护婴幼儿配方奶粉罐", spec: "800g", quantity: 9600, status: "completed", start_offset_days: -4, end_offset_days: -2, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0009", product_code: "C05-400-009", product_name: "君乐宝乐铂400g婴儿配方奶粉罐", spec: "400g", quantity: 5100, status: "released", start_offset_days: 3, end_offset_days: 5, order_type: "制罐生产订单", priority: 3 },
  { order_no: "MO-DEMO-0010", product_code: "C05-700-010", product_name: "美赞臣蓝臻700g较大婴儿配方奶粉罐", spec: "700g", quantity: 6700, status: "in_progress", start_offset_days: 0, end_offset_days: 4, order_type: "制罐生产订单", priority: 2 },
];

async function seedProducts() {
  const client = db();
  // 根据 SIMULATED_ORDERS 提取唯一物料
  const productMap = new Map<string, { code: string; name: string; specification: string; process_route: string; unit: string }>();
  for (const o of SIMULATED_ORDERS) {
    if (productMap.has(o.product_code)) continue;
    productMap.set(o.product_code, {
      code: o.product_code,
      name: o.product_name,
      specification: o.spec,
      unit: "罐",
      process_route: PROCESS_ROUTE.join("→"),
    });
  }
  const products = Array.from(productMap.values());
  const { error } = await client.from("products").insert(products);
  if (error) console.error("产品插入失败:", error.message);
  console.log(`✓ 物料字典：${products.length} 个 SKU`);
}

async function seedWorkOrders() {
  const client = db();

  // 把每条模拟订单按索引交替分配到 A/B 线
  const orderRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < SIMULATED_ORDERS.length; i++) {
    const o = SIMULATED_ORDERS[i];
    const engStatus = o.status;
    const lineCode = i % 2 === 0 ? "LINE-A" : "LINE-B";
    const lineName = lineCode === "LINE-A" ? "A线" : "B线";
    const isDone = engStatus === "completed";
    const isInProgress = engStatus === "in_progress";

    // 进度计算
    const totalQty = o.quantity;
    let completed = 0;
    let scrap = 0;
    if (isDone) {
      completed = totalQty;
      scrap = Math.max(1, Math.floor(totalQty * (0.005 + Math.random() * 0.01)));
    } else if (isInProgress) {
      completed = Math.floor(totalQty * (0.3 + Math.random() * 0.5));
      scrap = Math.floor(totalQty * (0.002 + Math.random() * 0.006));
    } else if (engStatus === "paused") {
      completed = Math.floor(totalQty * 0.15);
      scrap = Math.floor(totalQty * 0.003);
    } else {
      completed = 0;
      scrap = 0;
    }

    const plannedStart = daysFromToday(o.start_offset_days, 9);
    const plannedEnd = daysFromToday(o.end_offset_days, 17);
    const actualStart = isInProgress || isDone ? plannedStart : null;
    const actualEnd = isDone ? plannedEnd : null;

    orderRows.push({
      order_no: o.order_no,
      product_code: o.product_code,
      product_name: o.product_name,
      sales_order_no: null,
      planned_quantity: totalQty,
      completed_quantity: completed,
      scrap_quantity: scrap,
      status: engStatus,
      priority: o.priority,
      workshop_code: "WS-CN",
      workshop_name: "制罐车间",
      line_code: lineCode,
      line_name: lineName,
      order_type: o.order_type,
      unit: "罐",
      planned_start_date: plannedStart,
      planned_end_date: plannedEnd,
      actual_start_date: actualStart,
      actual_end_date: actualEnd,
      notes: null,
    });
  }

  const { data, error } = await client
    .from("work_orders")
    .insert(orderRows)
    .select("id, order_no, product_code, product_name, status, line_code, line_name, planned_start_date, planned_quantity, completed_quantity, priority");
  if (error) {
    console.error("工单插入失败:", error.message);
    return [];
  }
  const insertedOrders = data || [];
  console.log(`✓ 工单：${insertedOrders.length} 个`);

  // 为每个工单自动创建 13 道工序
  const allOps: Array<Record<string, unknown>> = [];
  for (const wo of insertedOrders) {
    const isInProgress = wo.status === "in_progress" || wo.status === "completed";
    const isDone = wo.status === "completed";
    const isPaused = wo.status === "paused";
    let procReached = 0;
    if (isDone) procReached = 13;
    else if (isInProgress) {
      const ratio = wo.completed_quantity / Math.max(wo.planned_quantity, 1);
      procReached = Math.max(1, Math.min(12, Math.floor(ratio * 13)));
    } else if (isPaused) {
      procReached = 3;
    }
    for (let i = 0; i < 13; i++) {
      const procName = PROCESS_ROUTE[i];
      const isLast = i === 12;
      const doneThis = procReached > i;
      const inProgressThis = procReached === i + 1 && isInProgress && !isDone;
      const opStatus = doneThis ? "completed" : inProgressThis ? "in_progress" : isPaused && i >= 3 ? "paused" : "pending";
      allOps.push({
        work_order_id: wo.id,
        sequence: i + 1,
        operation_name: procName,
        workstation: wo.line_code === "LINE-A" ? "A线主控台" : "B线主控台",
        standard_time_minutes: Math.max(30, Math.round((wo.planned_quantity || 0) / 500)),
        status: opStatus,
        start_time: doneThis ? daysFromToday(-2) : null,
        end_time: doneThis ? daysFromToday(-1) : null,
        good_quantity: doneThis ? Math.floor(wo.completed_quantity * (isLast ? 1 : 0.98)) : 0,
        scrap_quantity: doneThis ? Math.floor(wo.completed_quantity * 0.005) : 0,
        operator_name: doneThis ? "系统自动" : null,
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
      });
    }
  }
  const { error: opErr } = await client.from("work_order_operations").insert(allOps);
  if (opErr) console.error("工序插入失败:", opErr.message);
  console.log(`✓ 工序：${allOps.length} 条（${insertedOrders.length} 工单 × 13 道）`);

  return insertedOrders;
}

async function seedProductionPlans(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; planned_start_date: string; planned_quantity: number; priority: number }>) {
  const client = db();
  // 7 天滚动计划：把非已完工的工单分散到 7 天
  const eligible = orders.filter(
    (o) => o.status === "released" || o.status === "in_progress" || o.status === "paused"
  );
  const planRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < eligible.length; i++) {
    const o = eligible[i];
    const dayOffset = i % 7;
    const planDate = daysFromTodayDate(dayOffset);
    const priority = (o as { priority?: number | null }).priority ?? 3;
    planRows.push({
      plan_date: planDate,
      line_code: o.line_code,
      line_name: o.line_code === "LINE-A" ? "A线" : "B线",
      work_order_id: o.id,
      work_order_no: o.order_no,
      product_code: o.product_code,
      product_name: o.product_name,
      planned_quantity: o.planned_quantity,
      priority,
      status: "已排",
      notes: null,
    });
  }
  if (planRows.length > 0) {
    const { error } = await client.from("production_plans").insert(planRows);
    if (error) console.error("计划插入失败:", error.message);
  }
  console.log(`✓ 七天滚动计划：${planRows.length} 条`);
}

async function seedQualityData(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number; scrap_quantity: number }>) {
  const client = db();
  // 为已完成的工单生成 7 天的质量日报（每天每线 2-3 条）
  const reports: Array<Record<string, unknown>> = [];
  const completedOrders = orders.filter((o) => o.status === "completed");
  if (completedOrders.length === 0) {
    console.log("⏭ 无已完成工单，跳过质量日报");
    return;
  }
  for (let day = 6; day >= 0; day--) {
    const reportDate = daysFromTodayDate(-day);
    for (const line of ["LINE-A", "LINE-B"]) {
      const lineOrders = completedOrders.filter((o) => o.line_code === line);
      if (lineOrders.length === 0) continue;
      const wo = lineOrders[Math.floor(Math.random() * lineOrders.length)];
      const numProcesses = 2 + Math.floor(Math.random() * 2);
      for (let p = 0; p < numProcesses; p++) {
        const procIdx = [1, 4, 6, 7, 8, 9, 10][Math.floor(Math.random() * 7)];
        const proc = PROCESS_ROUTE[procIdx];
        const total = 1500 + Math.floor(Math.random() * 2000);
        const scrap = Math.max(1, Math.floor(total * (0.002 + Math.random() * 0.008)));
        const good = total - scrap;
        const passRate = good / total;
        const shift = Math.random() < 0.5 ? "白班" : "夜班";
        const canSpec = wo.product_name.includes("800g") ? "800g" : wo.product_name.includes("700g") ? "700g" : wo.product_name.includes("400g") ? "400g" : wo.product_name.includes("900g") ? "900g" : "标准";
        reports.push({
          report_date: reportDate,
          line_code: line,
          line_name: line === "LINE-A" ? "A线" : "B线",
          process_name: proc,
          product_code: wo.product_code,
          product_name: wo.product_name,
          can_spec: canSpec,
          can_height: 165,
          shift_no: shift,
          total_inspected: total,
          total_good: good,
          total_scrap: scrap,
          pass_rate: passRate,
          scrap_rate: 1 - passRate,
          defect_breakdown: {
            下料: proc === "下料" ? Math.floor(scrap * 0.6) : 0,
            焊接: proc === "焊接" ? Math.floor(scrap * 0.5) : 0,
            封口: proc === "封口" ? Math.floor(scrap * 0.4) : 0,
            测漏: proc === "测漏" ? Math.floor(scrap * 0.3) : 0,
            光检: proc.includes("光检") ? Math.floor(scrap * 0.7) : 0,
          },
        });
      }
    }
  }
  if (reports.length > 0) {
    const { error } = await client.from("daily_quality_reports").insert(reports);
    if (error) console.error("日报插入失败:", error.message);
  }
  console.log(`✓ 质量日报：${reports.length} 条（7 天 × 2 线 × 工序）`);
}

async function seedInspections(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number }>) {
  const client = db();
  // 为进行中/已完工工单写 2-3 条检验
  const candidates = orders.filter((o) => o.status === "completed" || o.status === "in_progress");
  const inspections: Array<Record<string, unknown>> = [];
  for (const wo of candidates) {
    const numInsp = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numInsp; i++) {
      const procIdx = [0, 1, 7, 9, 10][Math.floor(Math.random() * 5)];
      const proc = PROCESS_ROUTE[procIdx];
      const result = Math.random() < 0.92 ? "pass" : "fail";
      const inspType = procIdx === 0 ? "首件" : procIdx === 10 ? "末件" : "巡检";
      inspections.push({
        inspection_no: `QI-${Date.now()}-${i}-${wo.order_no.slice(-4)}`,
        work_order_id: wo.id,
        work_order_no: wo.order_no,
        inspection_type: inspType,
        product_code: wo.product_code,
        product_name: wo.product_name,
        batch_no: `${wo.order_no.slice(-6)}-${wo.line_code.slice(-1)}`,
        inspector_name: ["张工", "李工", "王工", "陈工"][Math.floor(Math.random() * 4)],
        inspection_time: nowIso(),
        sample_size: 50,
        result,
        defect_code: result === "fail" ? "D-CUT-01" : null,
        defect_description: result === "fail" ? "下料边缘有毛刺" : null,
        process_name: proc,
        line_code: wo.line_code,
        line_name: wo.line_name,
        can_spec: "标准",
        can_height: 165,
        shift_no: "白班",
        notes: null,
      });
    }
  }
  if (inspections.length > 0) {
    const { error } = await client.from("quality_inspections").insert(inspections);
    if (error) console.error("检验记录失败:", error.message);
    console.log(`✓ 检验记录：${inspections.length} 条`);
  }
}

async function main() {
  console.log("🌱 开始播种 长沙大满生产管理系统 数据...\n");
  await truncate();
  await seedFoundation();
  await seedProducts();
  const orders = (await seedWorkOrders()) || [];
  if (orders.length > 0) {
    await seedProductionPlans(orders as unknown as Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; planned_start_date: string; planned_quantity: number; priority: number; completed_quantity: number; scrap_quantity: number }>);
    await seedQualityData(orders as unknown as Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number; scrap_quantity: number }>);
    await seedInspections(orders as unknown as Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number }>);
  }
  console.log("\n✅ 全部种子数据写入完成");
  console.log("提示：访问 / 查看看板，/production-plan 查看 7 天计划，/quality-report 看日报");
}

main().catch((e) => {
  console.error("种子数据失败:", e);
  process.exit(1);
});
