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

async function seedProducts() {
  const client = db();
  const ordersFile = path.join(process.cwd(), "assets", "orders.json");
  if (!fs.existsSync(ordersFile)) {
    console.warn("未找到 orders.json，跳过产品导入");
    return;
  }
  const orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
  // 提取唯一料品
  const productMap = new Map<string, { code: string; name: string; specification: string; process_route: string; unit: string }>();
  for (const o of orders as unknown as Array<{ product_code: string; product_name: string }>) {
    if (!o.product_code || productMap.has(o.product_code)) continue;
    // 根据品名猜规格
    let spec = "";
    if (o.product_name.includes("800g")) spec = "800g";
    else if (o.product_name.includes("700g")) spec = "700g";
    else if (o.product_name.includes("400g")) spec = "400g";
    else if (o.product_name.includes("900g")) spec = "900g";
    else spec = "标准";
    productMap.set(o.product_code, {
      code: o.product_code,
      name: o.product_name,
      specification: spec,
      unit: "罐",
      process_route: PROCESS_ROUTE.join("→"),
    });
  }
  const products = Array.from(productMap.values());
  // 分批插入（避免一次过大）
  const batchSize = 30;
  for (let i = 0; i < products.length; i += batchSize) {
    const { error } = await client.from("products").insert(products.slice(i, i + batchSize));
    if (error) console.error("产品批次插入失败:", error.message);
  }
  console.log(`✓ 物料字典：${products.length} 个 SKU`);
}

async function seedWorkOrders() {
  const client = db();
  const ordersFile = path.join(process.cwd(), "assets", "orders.json");
  if (!fs.existsSync(ordersFile)) return;
  const orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8")) as Array<{
    category: string;
    order_no: string;
    status: string;
    product_code: string;
    product_name: string;
    quantity: number;
    unit: string;
    planned_start: string;
    planned_end: string;
  }>;

  // 把 . 替换为 - 让 ISO 解析
  const normalizeDate = (s: string): string => {
    if (!s) return nowIso();
    return s.replace(/\./g, "-");
  };

  // 按订单索引交替分配 A/B 线（前 50% 数量大多走 A 线）
  const orderRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const engStatus = STATUS_MAP[o.status] || "released";
    const lineCode = i % 2 === 0 ? "LINE-A" : "LINE-B";
    const lineName = lineCode === "LINE-A" ? "A线" : "B线";
    const isDone = engStatus === "completed";
    const isInProgress = engStatus === "in_progress";

    // 进度
    const totalQty = Number(o.quantity) || 0;
    let completed = 0;
    let scrap = 0;
    if (isDone) {
      completed = totalQty;
      scrap = Math.floor(totalQty * (0.005 + Math.random() * 0.015));
    } else if (isInProgress) {
      completed = Math.floor(totalQty * (0.3 + Math.random() * 0.5));
      scrap = Math.floor(totalQty * (0.002 + Math.random() * 0.008));
    } else {
      completed = 0;
      scrap = 0;
    }

    // 优先级：返工 > 计划中（按订单索引）
    const priority = o.category.includes("返工") ? 1 : Math.min(5, 2 + Math.floor(i / 50));

    // 实际开工/完工时间
    const plannedStart = normalizeDate(o.planned_start);
    const plannedEnd = normalizeDate(o.planned_end);
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
      priority,
      workshop_code: "WS-CN",
      workshop_name: "制罐车间",
      line_code: lineCode,
      line_name: lineName,
      order_type: o.category,
      unit: o.unit,
      planned_start_date: plannedStart,
      planned_end_date: plannedEnd,
      actual_start_date: actualStart,
      actual_end_date: actualEnd,
      notes: null,
    });
  }

  // 分批插入工单（每批 30）
  const batchSize = 30;
  const insertedOrders: Array<{ id: string; order_no: string; product_code: string; product_name: string; status: string; line_code: string; line_name: string; planned_start_date: string; planned_quantity: number; completed_quantity: number }> = [];
  for (let i = 0; i < orderRows.length; i += batchSize) {
    const batch = orderRows.slice(i, i + batchSize);
    const { data, error } = await client
      .from("work_orders")
      .insert(batch)
      .select("id, order_no, product_code, product_name, status, line_code, line_name, planned_start_date, planned_quantity, completed_quantity");
    if (error) {
      console.error("工单批次插入失败:", error.message);
    } else if (data) {
      insertedOrders.push(...data);
    }
  }
  console.log(`✓ 工单：${insertedOrders.length} 个`);

  // 为每个工单自动创建 13 道工序
  const allOps: Array<Record<string, unknown>> = [];
  for (const wo of insertedOrders) {
    const isInProgress = wo.status === "in_progress" || wo.status === "completed";
    const isDone = wo.status === "completed";
    // 工序进度估算：已完成的工单 13 道都完成；进行中的工单根据完成度推进
    let procReached = 0;
    if (isDone) procReached = 13;
    else if (isInProgress) {
      const ratio = wo.completed_quantity / Math.max(wo.planned_quantity, 1);
      procReached = Math.floor(ratio * 13);
      if (procReached === 0) procReached = 1; // 至少 1 道
    }
    for (let i = 0; i < 13; i++) {
      const procName = PROCESS_ROUTE[i];
      const isLast = i === 12;
      const doneThis = procReached > i;
      const inProgressThis = procReached === i + 1 && isInProgress && !isDone;
      const opStatus = doneThis ? "completed" : inProgressThis ? "in_progress" : "pending";
      allOps.push({
        work_order_id: wo.id,
        sequence: i + 1,
        operation_name: procName,
        workstation: wo.line_code === "LINE-A" ? "A线主控台" : "B线主控台",
        standard_time_minutes: Math.round((wo.planned_quantity || 0) / 500),
        status: opStatus,
        start_time: doneThis ? nowIso() : null,
        end_time: doneThis ? nowIso() : null,
        good_quantity: doneThis ? Math.floor(wo.completed_quantity * (isLast ? 1 : 0.95)) : 0,
        scrap_quantity: doneThis ? Math.floor(wo.completed_quantity * 0.005) : 0,
        operator_name: doneThis ? "系统自动" : null,
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
      });
    }
  }
  // 批量插入工序
  const opBatchSize = 100;
  let opInserted = 0;
  for (let i = 0; i < allOps.length; i += opBatchSize) {
    const { error } = await client.from("work_order_operations").insert(allOps.slice(i, i + opBatchSize));
    if (error) {
      console.error("工序批次插入失败:", error.message);
    } else {
      opInserted += Math.min(opBatchSize, allOps.length - i);
    }
  }
  console.log(`✓ 工序：${opInserted} 条（${insertedOrders.length} 工单 × 13 道）`);

  return insertedOrders;
}

async function seedProductionPlans(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; planned_start_date: string; planned_quantity: number; priority: number }>) {
  const client = db();
  // 7 天滚动计划：从今天起 7 天
  // 把未完工（开立/开工）的订单分配到这 7 天
  const eligible = orders.filter(
    (o) => o.status === "released" || o.status === "in_progress" || o.status === "paused"
  );
  const planRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < eligible.length; i++) {
    const o = eligible[i];
    // 按线分配日期
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
  const batchSize = 50;
  for (let i = 0; i < planRows.length; i += batchSize) {
    const { error } = await client.from("production_plans").insert(planRows.slice(i, i + batchSize));
    if (error) console.error("计划批次插入失败:", error.message);
  }
  console.log(`✓ 七天滚动计划：${planRows.length} 条`);
}

async function seedQualityData(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number; scrap_quantity: number }>) {
  const client = db();
  // 为已完成的工单生成近 7 天的质量日报
  const reports: Array<Record<string, unknown>> = [];
  for (let day = 6; day >= 0; day--) {
    const reportDate = daysFromTodayDate(-day);
    // 每天每条线 3-5 条日报
    for (const line of ["LINE-A", "LINE-B"]) {
      const numProcesses = 2 + Math.floor(Math.random() * 3);
      for (let p = 0; p < numProcesses; p++) {
        // 选 1-2 个工序
        const procIdx = Math.floor(Math.random() * 13);
        const proc = PROCESS_ROUTE[procIdx];
        // 选已完成工单作为产品
        const candidates = orders.filter((o) => o.status === "completed" && o.line_code === line);
        if (candidates.length === 0) continue;
        const wo = candidates[Math.floor(Math.random() * candidates.length)];
        const total = 2000 + Math.floor(Math.random() * 3000);
        const scrap = Math.floor(total * (0.002 + Math.random() * 0.01));
        const good = total - scrap;
        const passRate = good / total;
        const shift = Math.random() < 0.5 ? "白班" : "夜班";
        const canSpec = wo.product_name.includes("800g") ? "800g" : wo.product_name.includes("700g") ? "700g" : wo.product_name.includes("400g") ? "400g" : "标准";
        const canHeight = 165;
        reports.push({
          report_date: reportDate,
          line_code: line,
          line_name: line === "LINE-A" ? "A线" : "B线",
          process_name: proc,
          product_code: wo.product_code,
          product_name: wo.product_name,
          can_spec: canSpec,
          can_height: canHeight,
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
  const batchSize = 30;
  for (let i = 0; i < reports.length; i += batchSize) {
    const { error } = await client.from("daily_quality_reports").insert(reports.slice(i, i + batchSize));
    if (error) console.error("日报批次失败:", error.message);
  }
  console.log(`✓ 质量日报：${reports.length} 条（7 天 × 2 线 × 工序）`);
}

async function seedInspections(orders: Array<{ id: string; order_no: string; product_code: string; product_name: string; line_code: string; line_name: string; status: string; completed_quantity: number }>) {
  const client = db();
  // 为已完工工单写一些检验记录
  const candidates = orders.filter((o) => o.status === "completed" || o.status === "in_progress").slice(0, 20);
  const inspections: Array<Record<string, unknown>> = [];
  for (const wo of candidates) {
    const numInsp = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numInsp; i++) {
      const procIdx = [0, 1, 7, 8, 9, 10][Math.floor(Math.random() * 6)];
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
