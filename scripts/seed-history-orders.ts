/**
 * 补充生成 6月11日~6月16日 共 6 天 × 2 条 = 12 条历史工单
 * - 用现有 products 字典的产品
 * - A/B 线交替分配
 * - 6/11~6/14 已完工，6/15 在产，6/16 已下发
 * - 自动生成 13 道工序 + 工序报工 + 检验 + 日报
 */
import { getSupabaseClient } from "../src/storage/database/supabase-client";
import { CAN_PROCESS_NAMES } from "../src/lib/constants";
import { recomputeDailyQualityReport } from "../src/lib/daily-quality-service";

const SHIFTS = ["白班", "中班", "夜班"] as const;
const OPERATOR_NAMES = ["张工", "李工", "王工", "刘工", "陈工", "杨工", "赵工", "黄工", "周工", "吴工"];

const DAYS = ["2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15", "2026-06-16"];
const LINES_FOR_DAY: Array<[string, string]> = [
  ["LINE-A", "LINE-B"],
  ["LINE-B", "LINE-A"],
  ["LINE-A", "LINE-B"],
  ["LINE-B", "LINE-A"],
  ["LINE-A", "LINE-B"],
  ["LINE-B", "LINE-A"],
];

interface ProductRow {
  code: string;
  name: string;
  specification: string;
}

interface WorkOrderRow {
  id: string;
  order_no: string;
  status: string;
  planned_quantity: number;
  line_code: string;
  planned_start_date: string;
  planned_end_date: string;
  product_code: string;
  product_name: string;
  specification: string;
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function genOrderNo(dayIdx: number, slotIdx: number): string {
  const day = 11 + dayIdx;
  return `MO-HIST-${String(day).padStart(2, "0")}-${String(slotIdx + 1).padStart(2, "0")}`;
}

async function main() {
  const client = getSupabaseClient();
  console.log("→ 拉取物料字典...");
  const { data: products, error: prodErr } = await client
    .from("products")
    .select("code,name,specification")
    .order("code");
  if (prodErr) throw prodErr;
  if (!products || products.length === 0) throw new Error("物料字典为空，请先跑 seed-mes.ts");
  console.log(`  找到 ${products.length} 个产品`);

  // 12 条工单：每天 2 条，A/B 线交替
  interface OrderDef {
    order_no: string;
    product_code: string;
    product_name: string;
    spec: string;
    quantity: number;
    status: "completed" | "in_progress" | "released";
    line_code: string;
    line_name: string;
    plan_date: string;
    order_type: string;
    priority: number;
    customer_name: string;
  }
  const orders: OrderDef[] = [];

  for (let d = 0; d < DAYS.length; d++) {
    for (let i = 0; i < 2; i++) {
      const idx = d * 2 + i;
      const p = pick(products as ProductRow[], idx);
      const lineCode = LINES_FOR_DAY[d][i];
      let status: "completed" | "in_progress" | "released";
      if (d <= 3) status = "completed";
      else if (d === 4) status = "in_progress";
      else status = "released";
      const qty = 3000 + Math.floor(Math.random() * 9000);
      orders.push({
        order_no: genOrderNo(d, i),
        product_code: p.code,
        product_name: p.name,
        spec: p.specification,
        quantity: qty,
        status,
        line_code: lineCode,
        line_name: lineCode === "LINE-A" ? "A线" : "B线",
        plan_date: DAYS[d],
        order_type: "制罐生产订单",
        priority: 2 + (idx % 3),
        customer_name: pick(["飞鹤", "伊利", "合生元", "君乐宝", "美赞臣", "爱他美"], idx),
      });
    }
  }

  // 1. 插入 work_orders（已存在则跳过）
  console.log("→ 插入 12 条工单（已存在则跳过）...");
  const woRows = orders.map((o) => {
    const startISO = `${o.plan_date}T08:00:00+08:00`;
    const endISO = `${o.plan_date}T20:00:00+08:00`;
    return {
      order_no: o.order_no,
      product_code: o.product_code,
      product_name: o.product_name,
      specification: o.spec,
      planned_quantity: o.quantity,
      completed_quantity: o.status === "completed" ? o.quantity : 0,
      scrap_quantity: o.status === "completed" ? Math.max(1, Math.floor(o.quantity * 0.005)) : 0,
      status: o.status,
      priority: o.priority,
      workshop_code: "WS-CN",
      workshop_name: "制罐车间",
      line_code: o.line_code,
      line_name: o.line_name,
      customer_name: o.customer_name,
      order_type: o.order_type,
      unit: "罐",
      planned_start_date: startISO,
      planned_end_date: endISO,
      actual_start_date: startISO,
      actual_end_date: o.status === "completed" ? endISO : null,
    };
  });
  // 用 upsert 避免重复
  const { data: woData, error: woErr } = await client
    .from("work_orders")
    .upsert(woRows, { onConflict: "order_no", ignoreDuplicates: true })
    .select("id,order_no,status,planned_quantity,line_code,planned_start_date,planned_end_date,product_code,product_name,specification");
  if (woErr) {
    console.error("WO insert failed. First row keys:", Object.keys(woRows[0] || {}));
    throw woErr;
  }
  let woList = woData as WorkOrderRow[];
  // 重新拉取完整的 12 条（含已存在的）
  const { data: allWo } = await client
    .from("work_orders")
    .select("id,order_no,status,planned_quantity,line_code,planned_start_date,planned_end_date,product_code,product_name,specification")
    .in("order_no", orders.map((o) => o.order_no));
  if (allWo && allWo.length === 12) woList = allWo as WorkOrderRow[];
  console.log(`  ✓ 工单 ${woList.length} 条`);

  // 2. 插入 13 道工序（先清掉旧的）
  console.log("→ 为每个工单生成 13 道工序...");
  await client.from("work_order_operations").delete().in("work_order_id", woList.map((w) => w.id));
  const opRows: Array<Record<string, unknown>> = [];
  for (const wo of woList) {
    for (let i = 0; i < CAN_PROCESS_NAMES.length; i++) {
      const proc = CAN_PROCESS_NAMES[i];
      const isDone = wo.status === "completed";
      const isInProgress = wo.status === "in_progress";
      let procStatus: "completed" | "in_progress" | "released";
      if (isDone) procStatus = "completed";
      else if (isInProgress) procStatus = i < 6 ? "completed" : i === 6 ? "in_progress" : "released";
      else procStatus = "released";
      opRows.push({
        work_order_id: wo.id,
        sequence: i + 1,
        operation_name: proc,
        status: procStatus,
        good_quantity: procStatus === "completed" ? wo.planned_quantity : procStatus === "in_progress" ? Math.floor(wo.planned_quantity * 0.4) : 0,
        scrap_quantity: procStatus === "completed" ? Math.max(0, Math.floor(wo.planned_quantity * 0.003)) : 0,
        start_time: wo.planned_start_date,
        end_time: wo.planned_end_date,
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
      });
    }
  }
  const { data: opData, error: opErr } = await client
    .from("work_order_operations")
    .insert(opRows)
    .select("id,work_order_id,operation_name,status,good_quantity,scrap_quantity");
  if (opErr) throw opErr;
  const opList = opData as Array<{
    id: string;
    work_order_id: string;
    operation_name: string;
    status: string;
    good_quantity: number;
    scrap_quantity: number;
  }>;
  console.log(`  ✓ 工序 ${opList.length} 条`);

  // 3. 插入工序报工（先清掉旧的）
  console.log("→ 生成工序报工...");
  await client.from("work_order_reports").delete().in("work_order_id", woList.map((w) => w.id));
  const reportRows: Array<Record<string, unknown>> = [];
  for (const op of opList) {
    const wo = woList.find((w) => w.id === op.work_order_id);
    if (!wo) continue;
    if (op.status === "completed" || (wo.status === "in_progress" && op.status === "in_progress")) {
      const good = op.good_quantity;
      const scrap = op.scrap_quantity || 0;
      const total = good + scrap;
      reportRows.push({
        work_order_id: op.work_order_id,
        operation_id: op.id,
        report_type: "正常",
        work_order_no: wo.order_no,
        process_name: op.operation_name,
        product_code: wo.product_code,
        product_name: wo.product_name,
        operator_name: pick(OPERATOR_NAMES, total),
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
        shift_no: pick(SHIFTS, total),
        good_quantity: good,
        scrap_quantity: scrap,
        batch_no: `${wo.order_no.replace("MO-", "")}-${op.operation_name.slice(0, 2)}`,
        reported_at: wo.planned_end_date,
        scrap_reason: null,
        notes: "正常",
      });
    }
  }
  if (reportRows.length > 0) {
    const { data: repData, error: repErr } = await client.from("work_order_reports").insert(reportRows).select("id");
    if (repErr) throw repErr;
    console.log(`  ✓ 报工 ${(repData as Array<{ id: string }>).length} 条`);
  } else {
    console.log(`  ✓ 报工 0 条`);
  }

  // 4. 插入 production_plans（先清掉旧的）
  console.log("→ 生成生产计划...");
  await client.from("production_plans").delete().in("work_order_id", woList.map((w) => w.id));
  const planRows = woList.map((wo) => ({
    plan_date: (wo.planned_start_date as string).slice(0, 10),
    line_code: wo.line_code,
    line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
    work_order_id: wo.id,
    work_order_no: wo.order_no,
    product_code: wo.product_code,
    product_name: wo.product_name,
    planned_quantity: wo.planned_quantity,
    priority: 2,
    status: "已排",
    notes: "历史回填",
  }));
  const { data: planData, error: planErr } = await client.from("production_plans").insert(planRows).select("id");
  if (planErr) throw planErr;
  console.log(`  ✓ 计划 ${(planData as Array<{ id: string }>).length} 条`);

  // 5. 插入质量检验（先清掉旧的）
  console.log("→ 生成质量检验...");
  await client.from("quality_inspections").delete().in("work_order_id", woList.map((w) => w.id));
  const inspRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < woList.length; i++) {
    const wo = woList[i];
    if (wo.status === "completed") {
      inspRows.push({
        inspection_no: `QI-${wo.order_no}-FINAL`,
        work_order_id: wo.id,
        work_order_no: wo.order_no,
        inspection_type: "末件",
        product_code: wo.product_code,
        product_name: wo.product_name,
        batch_no: `B-${wo.order_no}`,
        inspector_name: pick(OPERATOR_NAMES, i),
        inspection_time: wo.planned_end_date,
        sample_size: 50,
        pass_quantity: 48,
        fail_quantity: 2,
        result: "合格",
        defect_code: null,
        defect_description: null,
        measurements: null,
        notes: "包装入库前终检",
        process_name: "包装",
        shift_no: pick(SHIFTS, i),
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
      });
    }
    if (i % 3 === 0) {
      inspRows.push({
        inspection_no: `QI-${wo.order_no}-FIRST`,
        work_order_id: wo.id,
        work_order_no: wo.order_no,
        inspection_type: "首件",
        product_code: wo.product_code,
        product_name: wo.product_name,
        batch_no: `B-${wo.order_no}`,
        inspector_name: pick(OPERATOR_NAMES, i + 1),
        inspection_time: wo.planned_start_date,
        sample_size: 20,
        pass_quantity: 20,
        fail_quantity: 0,
        result: "合格",
        defect_code: null,
        defect_description: null,
        measurements: null,
        notes: "开班首件确认",
        process_name: "下料",
        shift_no: "白班",
        line_code: wo.line_code,
        line_name: wo.line_code === "LINE-A" ? "A线" : "B线",
      });
    }
  }
  if (inspRows.length > 0) {
    const { data: inspData, error: inspErr } = await client.from("quality_inspections").insert(inspRows).select("id");
    if (inspErr) throw inspErr;
    console.log(`  ✓ 检验 ${(inspData as Array<{ id: string }>).length} 条`);
  }

  // 6. 触发日报聚合
  console.log("→ 触发日报聚合...");
  let totalWritten = 0;
  for (const day of DAYS) {
    for (const proc of CAN_PROCESS_NAMES) {
      for (const lineCode of ["LINE-A", "LINE-B"] as const) {
        const lineName = lineCode === "LINE-A" ? "A线" : "B线";
        try {
          // 找出该日该线该工序涉及的 (product_code, product_name, shift_no) 组合
          const { data: repRows } = await client
            .from("work_order_reports")
            .select("good_quantity,scrap_quantity,total_quantity,work_order_id,shift_no,line_code")
            .eq("process_name", proc)
            .eq("line_code", lineCode)
            .gte("reported_at", `${day}T00:00:00`)
            .lte("reported_at", `${day}T23:59:59`);
          if (!repRows || repRows.length === 0) continue;

          // 按 (work_order_id, shift_no) 分组
          const groups = new Map<string, { work_order_id: string; shift_no: string; good: number; scrap: number }>();
          for (const r of repRows as Array<{
            good_quantity: number | null;
            scrap_quantity: number | null;
            work_order_id: string;
            shift_no: string | null;
          }>) {
            const key = `${r.work_order_id}|${r.shift_no || "白班"}`;
            const cur = groups.get(key) ?? { work_order_id: r.work_order_id, shift_no: r.shift_no || "白班", good: 0, scrap: 0 };
            cur.good += r.good_quantity || 0;
            cur.scrap += r.scrap_quantity || 0;
            groups.set(key, cur);
          }

          for (const g of groups.values()) {
            const wo = woList.find((w) => w.id === g.work_order_id);
            if (!wo) continue;
            await recomputeDailyQualityReport({
              report_date: day,
              line_code: lineCode,
              line_name: lineName,
              process_name: proc,
              product_code: wo.product_code,
              product_name: wo.product_name,
              shift_no: g.shift_no,
            });
            totalWritten++;
          }
        } catch (e) {
          // 静默失败，继续
        }
      }
    }
  }
  console.log(`  ✓ 日报聚合完成（${totalWritten} 次写入尝试）`);

  console.log("\n=== 完成 ===");
  console.log(`12 条工单 (6/11~6/16 每天 2 条) + 13 道工序 + 报工 + 计划 + 检验 + 日报 已写入`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
