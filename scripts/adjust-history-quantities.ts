/**
 * 调整历史工单数量：
 *  - 单日合计控制在 2.5 万 - 5 万罐
 *  - 计划数量与实际完工数量偏差不超过 10%
 */
import { getSupabaseClient } from "../src/storage/database/supabase-client";
import { recomputeDailyQualityReport } from "../src/lib/daily-quality-service";

const client = getSupabaseClient();

// 单工单计划量调整（计划与实际保持 0 偏差或 ±10%）
const planData: Array<{
  order_no: string;
  planned_quantity: number;     // 计划数量
  completed_quantity: number;   // 实际完工
  scrap_quantity: number;       // 不良
  status: "released" | "in_progress" | "paused" | "completed";
}> = [
  // 6/11 (合计 45000)
  { order_no: "MO-HIST-11-01", planned_quantity: 22500, completed_quantity: 22000, scrap_quantity: 110, status: "completed" },
  { order_no: "MO-HIST-11-02", planned_quantity: 22500, completed_quantity: 22800, scrap_quantity: 115, status: "completed" },
  // 6/12 (合计 32000)
  { order_no: "MO-HIST-12-01", planned_quantity: 18000, completed_quantity: 17500, scrap_quantity: 90, status: "completed" },
  { order_no: "MO-HIST-12-02", planned_quantity: 14000, completed_quantity: 14200, scrap_quantity: 70, status: "completed" },
  // 6/13 (合计 38500)
  { order_no: "MO-HIST-13-01", planned_quantity: 16500, completed_quantity: 16200, scrap_quantity: 80, status: "completed" },
  { order_no: "MO-HIST-13-02", planned_quantity: 22000, completed_quantity: 21800, scrap_quantity: 110, status: "completed" },
  // 6/14 (合计 48000)
  { order_no: "MO-HIST-14-01", planned_quantity: 24000, completed_quantity: 23500, scrap_quantity: 120, status: "completed" },
  { order_no: "MO-HIST-14-02", planned_quantity: 24000, completed_quantity: 24200, scrap_quantity: 125, status: "completed" },
  // 6/15 (合计 42000, 全部已开工完成)
  { order_no: "MO-HIST-15-01", planned_quantity: 21000, completed_quantity: 20500, scrap_quantity: 105, status: "completed" },
  { order_no: "MO-HIST-15-02", planned_quantity: 21000, completed_quantity: 21200, scrap_quantity: 108, status: "completed" },
  // 6/16 (合计 26000, 已开工接近完工, 偏差 < 10%)
  { order_no: "MO-HIST-16-01", planned_quantity: 13000, completed_quantity: 12500, scrap_quantity: 62, status: "in_progress" },
  { order_no: "MO-HIST-16-02", planned_quantity: 13000, completed_quantity: 12200, scrap_quantity: 60, status: "in_progress" },
];

async function main() {
  // Step 1: 更新工单的 planned_quantity / completed_quantity / scrap_quantity / status
  console.log("=== Step 1: 更新工单数量/状态 ===");
  for (const w of planData) {
    // 计算单日偏差
    const deviation = Math.abs(w.planned_quantity - w.completed_quantity) / w.planned_quantity;
    const deviationStr = (deviation * 100).toFixed(2);

    const { error } = await client
      .from("work_orders")
      .update({
        planned_quantity: w.planned_quantity,
        completed_quantity: w.completed_quantity,
        scrap_quantity: w.scrap_quantity,
        status: w.status,
      })
      .eq("order_no", w.order_no);

    if (error) {
      console.error(`  ✗ ${w.order_no}: ${error.message}`);
    } else {
      console.log(
        `  ✓ ${w.order_no} 计划=${w.planned_quantity} 实际=${w.completed_quantity} 不良=${w.scrap_quantity} 偏差=${deviationStr}% 状态=${w.status}`
      );
    }
  }

  // Step 2: 同步 production_plans.planned_quantity
  console.log("\n=== Step 2: 同步生产计划数量 ===");
  for (const w of planData) {
    const { error } = await client
      .from("production_plans")
      .update({ planned_quantity: w.planned_quantity })
      .eq("work_order_no", w.order_no);
    if (error) {
      console.error(`  ✗ ${w.order_no}: ${error.message}`);
    } else {
      console.log(`  ✓ ${w.order_no} plan 数量 → ${w.planned_quantity}`);
    }
  }

  // Step 3: 重新生成 6/15-6/16 的工序报工
  console.log("\n=== Step 3: 重新生成工序报工（6/15-6/16）===");

  // 取 6/15-6/16 工单的所有工序
  const targetOrders = planData.filter((w) => w.order_no.includes("15") || w.order_no.includes("16"));
  for (const w of targetOrders) {
    const { data: ops, error: opsErr } = await client
      .from("work_order_operations")
      .select("id, work_order_id, sequence, operation_name, status")
      .eq("work_order_id", (
        await client.from("work_orders").select("id").eq("order_no", w.order_no).single()
      ).data?.id ?? "");

    if (opsErr || !ops || ops.length === 0) {
      console.error(`  ✗ ${w.order_no}: 拉工序失败 - ${opsErr?.message}`);
      continue;
    }

    // 删除现有报工
    const opIds = ops.map((o) => o.id);
    await client.from("work_order_reports").delete().in("operation_id", opIds);

    // 累计报工数量：从前向后按工序分配
    // 已完工的工单：每道工序都按总量 1/13 + 微小波动
    // 在产的工单：按工序完成度分配
    const isCompleted = w.status === "completed";
    const completionRatio = w.completed_quantity / w.planned_quantity;
    // 每道工序应报工的总量
    const perProcessTotal = w.completed_quantity;
    // 每道工序平均分摊（含班次差异）
    const perProcessAvg = perProcessTotal / ops.length;

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      // 每道工序不一定都完工（除 "completed" 状态外）
      const isThisOpDone = isCompleted || (i / ops.length) < completionRatio;
      if (!isThisOpDone) continue;

      // 不良率参考全工单不良率
      const scrapRate = w.scrap_quantity / w.planned_quantity;
      // 单工序不良 + 良好分配（让所有 13 道合计 = w.completed_quantity, 不良 = w.scrap_quantity）
      const baseQty = Math.round(perProcessAvg);
      const opScrap = Math.max(0, Math.round(baseQty * scrapRate));
      const opGood = baseQty - opScrap;

      // 第一道工序报在 6/15-6/16 工单当天，最后一道工序报在合理时间
      const dayBase = w.order_no.includes("15") ? "2026-06-15" : "2026-06-16";
      // 按工序序号错开时间（每小时一道）
      const startHour = 8 + i;
      const reportedAt = `${dayBase}T${String(startHour).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00+08:00`;
      // 班次
      const shift = startHour < 16 ? "白班" : "夜班";

      // 末工序时间稍晚一些
      const opStart = `${dayBase}T${String(startHour).padStart(2, "0")}:00:00+08:00`;
      const opEnd = `${dayBase}T${String(startHour + 1).padStart(2, "0")}:00:00+08:00`;

      // 更新工序状态与时间
      await client
        .from("work_order_operations")
        .update({
          status: "completed",
          start_time: opStart,
          end_time: opEnd,
          good_quantity: opGood,
          scrap_quantity: opScrap,
        })
        .eq("id", op.id);

      // 插入报工
      const { error: repErr } = await client.from("work_order_reports").insert({
        work_order_id: op.work_order_id,
        operation_id: op.id,
        process_name: op.operation_name,
        operator_name: ["李工", "王工", "张工", "赵工", "陈工", "刘工", "杨工", "周工"][i % 8],
        line_code: w.order_no.includes("A") ? "LINE-A" : "LINE-B",
        shift_no: shift,
        good_quantity: opGood,
        scrap_quantity: opScrap,
        batch_no: `${w.order_no.slice(-2)}-${op.operation_name}`,
        reported_at: reportedAt,
        report_type: "正常",
        scrap_reason: opScrap > 0 ? "焊点偏移" : null,
      });

      if (repErr) {
        console.error(`  ✗ ${w.order_no} ${op.operation_name}: ${repErr.message}`);
      }
    }
    console.log(`  ✓ ${w.order_no} 重写 ${ops.length} 道工序报工`);
  }

  // Step 4: 重新聚合 6/15-6/16 质量日报
  console.log("\n=== Step 4: 重新聚合质量日报 ===");
  for (const w of targetOrders) {
    const { data: wo } = await client
      .from("work_orders")
      .select("id, planned_start_date, line_code, line_name, product_code, product_name")
      .eq("order_no", w.order_no)
      .single();

    if (!wo) continue;

    const startDate = new Date(wo.planned_start_date);
    const dateStr = startDate.toISOString().slice(0, 10);
    // 拉该工单该日报工，按 (process_name, shift_no) 聚合
    const { data: reps } = await client
      .from("work_order_reports")
      .select("process_name, shift_no, good_quantity, scrap_quantity, can_spec, can_height")
      .eq("work_order_id", wo.id);

    if (!reps) continue;

    // 聚合键 = (process, shift)
    const groups = new Map<string, { process: string; shift: string; good: number; scrap: number; can_spec?: string | null; can_height?: number | null; }>();
    for (const r of reps) {
      const key = `${r.process_name}|${r.shift_no ?? "白班"}`;
      const cur = groups.get(key) ?? { process: r.process_name ?? "包装", shift: r.shift_no ?? "白班", good: 0, scrap: 0, can_spec: r.can_spec, can_height: r.can_height };
      cur.good += r.good_quantity ?? 0;
      cur.scrap += r.scrap_quantity ?? 0;
      groups.set(key, cur);
    }

    for (const g of groups.values()) {
      try {
        await recomputeDailyQualityReport({
          report_date: dateStr,
          line_code: wo.line_code ?? "",
          line_name: wo.line_name ?? "",
          process_name: g.process,
          product_code: wo.product_code ?? "",
          product_name: wo.product_name ?? "",
          can_spec: g.can_spec ?? undefined,
          can_height: g.can_height ?? undefined,
          shift_no: g.shift,
        });
        console.log(`  ✓ ${dateStr} ${wo.line_code} ${g.process} ${g.shift} 日报重算`);
      } catch (e) {
        console.error(`  ✗ ${dateStr} ${wo.line_code} ${g.process} ${g.shift}: ${(e as Error).message}`);
      }
    }
  }

  // Step 5: 验证
  console.log("\n=== Step 5: 验证日合计与偏差 ===");
  for (const w of planData) {
    const deviation = Math.abs(w.planned_quantity - w.completed_quantity) / w.planned_quantity;
    console.log(
      `  ${w.order_no}: 计划=${w.planned_quantity} 实际=${w.completed_quantity} 不良=${w.scrap_quantity} 偏差=${(deviation * 100).toFixed(2)}%`
    );
  }
}

main().then(() => {
  console.log("\n=== 完成 ===");
  process.exit(0);
}).catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
