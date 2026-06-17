/**
 * MES 种子数据脚本
 * 执行：npx tsx scripts/seed-mes.ts
 * 或：通过 /api/seed 接口触发
 */

import { getSupabaseClient } from "../src/storage/database/supabase-client";

const db = () => getSupabaseClient();

function offsetDate(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function offsetDateOnly(days: number): string {
  return offsetDate(days).slice(0, 10);
}

async function seed() {
  const client = db();
  console.log("开始播种 MES 种子数据...");

  // 1. 车间
  console.log("· 车间");
  const workshops = [
    { code: "WS-01", name: "一车间（精加工）", description: "CNC 加工中心" },
    { code: "WS-02", name: "二车间（车削）", description: "数控车床" },
    { code: "WS-03", name: "三车间（磨齿）", description: "磨齿、热处理" },
  ];
  await client.from("workshops").upsert(workshops, { onConflict: "code" });

  // 2. 物料字典
  console.log("· 物料字典");
  const products = [
    { code: "P-CASE-001", name: "减速机箱体", specification: "HT250 / 380×280×180", unit: "件", process_route: "粗车→精车→铣削→钻孔→钳工去毛刺→检验" },
    { code: "P-SHAFT-002", name: "传动主轴", specification: "45# / φ80×620", unit: "件", process_route: "下料→车削→铣键槽→磨外圆→热处理→精磨→检验" },
    { code: "P-GEAR-003", name: "斜齿轮", specification: "20CrMnTi / m=3 z=42", unit: "件", process_route: "锻造→粗车→精车→滚齿→倒角→热处理→磨齿→检验" },
    { code: "P-FLANGE-004", name: "法兰盘", specification: "Q235 / φ200×30", unit: "件", process_route: "下料→车削→钻孔→去毛刺→检验" },
    { code: "P-CASE-005", name: "发动机壳体", specification: "HT200 / 450×320×210", unit: "件", process_route: "粗铣→精铣→钻孔→攻丝→清洗→检验" },
    { code: "P-PINION-006", name: "小齿轮", specification: "40Cr / m=2 z=20", unit: "件", process_route: "下料→车削→滚齿→热处理→磨齿→检验" },
  ];
  await client.from("products").upsert(products, { onConflict: "code" });

  // 3. U9 销售订单
  console.log("· U9 销售订单");
  const u9Orders = [
    { sales_order_no: "SO-2024-0612-001", customer_code: "C001", customer_name: "三一重工", product_code: "P-CASE-001", product_name: "减速机箱体", quantity: 200, unit: "件", delivery_date: offsetDateOnly(7), status: "已审核" },
    { sales_order_no: "SO-2024-0612-002", customer_code: "C002", customer_name: "徐工集团", product_code: "P-SHAFT-002", product_name: "传动主轴", quantity: 150, unit: "件", delivery_date: offsetDateOnly(10), status: "已审核" },
    { sales_order_no: "SO-2024-0613-001", customer_code: "C003", customer_name: "中联重科", product_code: "P-GEAR-003", product_name: "斜齿轮", quantity: 500, unit: "件", delivery_date: offsetDateOnly(14), status: "已审核" },
    { sales_order_no: "SO-2024-0613-002", customer_code: "C001", customer_name: "三一重工", product_code: "P-FLANGE-004", product_name: "法兰盘", quantity: 300, unit: "件", delivery_date: offsetDateOnly(5), status: "已审核" },
    { sales_order_no: "SO-2024-0614-001", customer_code: "C004", customer_name: "潍柴动力", product_code: "P-CASE-005", product_name: "发动机壳体", quantity: 100, unit: "件", delivery_date: offsetDateOnly(20), status: "已审核" },
    { sales_order_no: "SO-2024-0614-002", customer_code: "C005", customer_name: "柳工机械", product_code: "P-PINION-006", product_name: "小齿轮", quantity: 800, unit: "件", delivery_date: offsetDateOnly(12), status: "已审核" },
  ];
  await client.from("u9_sales_orders").upsert(u9Orders, { onConflict: "sales_order_no" });

  // 4. 设备
  console.log("· 设备");
  // 先清空旧数据（依赖顺序：先删依赖 equipment 的 oee 和 maintenance）
  await client.from("equipment_oee").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await client.from("equipment_maintenance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await client.from("equipment").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const equipment: Array<{
    code: string;
    name: string;
    type: string;
    model: string;
    manufacturer: string;
    workshop_code: string;
    workshop_name: string;
    status: string;
    current_work_order_no: string | null;
    last_maintenance_date: string | null;
    next_maintenance_date: string | null;
    oee_target: string;
  }> = [
    { code: "EQ-CNC-001", name: "CNC加工中心 #1", type: "CNC加工中心", model: "VMC-1060L", manufacturer: "北京精雕", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "运行中", current_work_order_no: "WO-20240612-001", last_maintenance_date: offsetDateOnly(-15), next_maintenance_date: offsetDateOnly(15), oee_target: "85.00" },
    { code: "EQ-CNC-002", name: "CNC加工中心 #2", type: "CNC加工中心", model: "VMC-1060L", manufacturer: "北京精雕", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "运行中", current_work_order_no: "WO-20240612-002", last_maintenance_date: offsetDateOnly(-20), next_maintenance_date: offsetDateOnly(10), oee_target: "85.00" },
    { code: "EQ-CNC-003", name: "CNC加工中心 #3", type: "CNC加工中心", model: "DMU-100P", manufacturer: "德马吉", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "待机", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-5), next_maintenance_date: offsetDateOnly(25), oee_target: "85.00" },
    { code: "EQ-LATHE-001", name: "数控车床 #1", type: "数控车床", model: "CK6150", manufacturer: "沈阳第一机床厂", workshop_code: "WS-02", workshop_name: "二车间（车削）", status: "运行中", current_work_order_no: "WO-20240612-003", last_maintenance_date: offsetDateOnly(-10), next_maintenance_date: offsetDateOnly(20), oee_target: "85.00" },
    { code: "EQ-LATHE-002", name: "数控车床 #2", type: "数控车床", model: "CK6150", manufacturer: "沈阳第一机床厂", workshop_code: "WS-02", workshop_name: "二车间（车削）", status: "维保中", current_work_order_no: null, last_maintenance_date: offsetDateOnly(0), next_maintenance_date: offsetDateOnly(30), oee_target: "85.00" },
    { code: "EQ-LATHE-003", name: "数控车床 #3", type: "数控车床", model: "CAK6150", manufacturer: "济南第一机床", workshop_code: "WS-02", workshop_name: "二车间（车削）", status: "故障", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-30), next_maintenance_date: offsetDateOnly(0), oee_target: "85.00" },
    { code: "EQ-MILL-001", name: "数控铣床 #1", type: "数控铣床", model: "XK7130", manufacturer: "南通科技", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "运行中", current_work_order_no: "WO-20240613-001", last_maintenance_date: offsetDateOnly(-12), next_maintenance_date: offsetDateOnly(18), oee_target: "85.00" },
    { code: "EQ-GRIND-001", name: "外圆磨床 #1", type: "磨床", model: "MK1320A", manufacturer: "上海机床厂", workshop_code: "WS-03", workshop_name: "三车间（磨齿）", status: "运行中", current_work_order_no: "WO-20240613-002", last_maintenance_date: offsetDateOnly(-8), next_maintenance_date: offsetDateOnly(22), oee_target: "85.00" },
    { code: "EQ-GRIND-002", name: "齿轮磨床 #1", type: "磨床", model: "YK3140", manufacturer: "南京二机床", workshop_code: "WS-03", workshop_name: "三车间（磨齿）", status: "待机", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-3), next_maintenance_date: offsetDateOnly(27), oee_target: "85.00" },
    { code: "EQ-DRILL-001", name: "摇臂钻床 #1", type: "钻床", model: "Z3050", manufacturer: "齐齐哈尔第二机床厂", workshop_code: "WS-02", workshop_name: "二车间（车削）", status: "运行中", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-18), next_maintenance_date: offsetDateOnly(12), oee_target: "85.00" },
    { code: "EQ-DRILL-002", name: "摇臂钻床 #2", type: "钻床", model: "Z3040", manufacturer: "齐齐哈尔第二机床厂", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "运行中", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-22), next_maintenance_date: offsetDateOnly(8), oee_target: "85.00" },
    { code: "EQ-WIRE-001", name: "线切割 #1", type: "线切割", model: "DK7740", manufacturer: "苏州三光", workshop_code: "WS-01", workshop_name: "一车间（精加工）", status: "待机", current_work_order_no: null, last_maintenance_date: offsetDateOnly(-7), next_maintenance_date: offsetDateOnly(23), oee_target: "85.00" },
  ];
  const { error: eqErr } = await client.from("equipment").insert(equipment);
  if (eqErr) console.error("设备插入失败:", eqErr.message);

  // 5. 不良代码字典
  console.log("· 不良代码");
  const defectCodes = [
    { code: "D-001", name: "外径超差", category: "尺寸超差", severity: "严重" },
    { code: "D-002", name: "内径超差", category: "尺寸超差", severity: "严重" },
    { code: "D-003", name: "长度超差", category: "尺寸超差", severity: "一般" },
    { code: "D-004", name: "平行度超差", category: "形位公差", severity: "严重" },
    { code: "D-005", name: "垂直度超差", category: "形位公差", severity: "严重" },
    { code: "D-006", name: "粗糙度不达标", category: "表面缺陷", severity: "一般" },
    { code: "D-007", name: "表面划伤", category: "表面缺陷", severity: "一般" },
    { code: "D-008", name: "表面锈蚀", category: "表面缺陷", severity: "轻微" },
    { code: "D-009", name: "硬度不达标", category: "材质异常", severity: "严重" },
    { code: "D-010", name: "成分不合格", category: "材质异常", severity: "严重" },
    { code: "D-011", name: "孔位偏移", category: "尺寸超差", severity: "一般" },
    { code: "D-012", name: "螺纹不合格", category: "装配异常", severity: "一般" },
  ];
  await client.from("defect_codes").upsert(defectCodes, { onConflict: "code" });

  // 6. 工单（混合状态）
  console.log("· 工单");
  const workOrders = [
    { order_no: "WO-20240612-001", sales_order_no: "SO-2024-0612-001", product_code: "P-CASE-001", product_name: "减速机箱体", specification: "HT250 / 380×280×180", planned_quantity: 200, completed_quantity: 142, scrap_quantity: 3, status: "生产中", priority: 1, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(-1, 0), planned_end_date: offsetDate(6, 0), actual_start_date: offsetDate(-1, 0), customer_name: "三一重工" },
    { order_no: "WO-20240612-002", sales_order_no: "SO-2024-0612-002", product_code: "P-SHAFT-002", product_name: "传动主轴", specification: "45# / φ80×620", planned_quantity: 150, completed_quantity: 88, scrap_quantity: 2, status: "生产中", priority: 2, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(-2, 0), planned_end_date: offsetDate(7, 0), actual_start_date: offsetDate(-2, 0), customer_name: "徐工集团" },
    { order_no: "WO-20240612-003", sales_order_no: "SO-2024-0613-001", product_code: "P-GEAR-003", product_name: "斜齿轮", specification: "20CrMnTi / m=3 z=42", planned_quantity: 500, completed_quantity: 156, scrap_quantity: 5, status: "生产中", priority: 1, workshop_code: "WS-02", workshop_name: "二车间（车削）", planned_start_date: offsetDate(-3, 0), planned_end_date: offsetDate(11, 0), actual_start_date: offsetDate(-3, 0), customer_name: "中联重科" },
    { order_no: "WO-20240613-001", sales_order_no: "SO-2024-0613-002", product_code: "P-FLANGE-004", product_name: "法兰盘", specification: "Q235 / φ200×30", planned_quantity: 300, completed_quantity: 280, scrap_quantity: 4, status: "生产中", priority: 2, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(-2, 0), planned_end_date: offsetDate(3, 0), actual_start_date: offsetDate(-2, 0), customer_name: "三一重工" },
    { order_no: "WO-20240613-002", sales_order_no: "SO-2024-0614-001", product_code: "P-CASE-005", product_name: "发动机壳体", specification: "HT200 / 450×320×210", planned_quantity: 100, completed_quantity: 32, scrap_quantity: 1, status: "生产中", priority: 3, workshop_code: "WS-03", workshop_name: "三车间（磨齿）", planned_start_date: offsetDate(-1, 0), planned_end_date: offsetDate(19, 0), actual_start_date: offsetDate(-1, 0), customer_name: "潍柴动力" },
    { order_no: "WO-20240614-001", sales_order_no: "SO-2024-0614-002", product_code: "P-PINION-006", product_name: "小齿轮", specification: "40Cr / m=2 z=20", planned_quantity: 800, completed_quantity: 0, scrap_quantity: 0, status: "已下发", priority: 2, workshop_code: "WS-02", workshop_name: "二车间（车削）", planned_start_date: offsetDate(1, 0), planned_end_date: offsetDate(11, 0), customer_name: "柳工机械" },
    { order_no: "WO-20240615-001", product_code: "P-CASE-001", product_name: "减速机箱体", planned_quantity: 150, completed_quantity: 0, scrap_quantity: 0, status: "计划中", priority: 4, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(3, 0), planned_end_date: offsetDate(15, 0), customer_name: "三一重工" },
    { order_no: "WO-20240615-002", product_code: "P-SHAFT-002", product_name: "传动主轴", planned_quantity: 200, completed_quantity: 0, scrap_quantity: 0, status: "计划中", priority: 4, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(5, 0), planned_end_date: offsetDate(18, 0), customer_name: "徐工集团" },
    { order_no: "WO-20240610-001", product_code: "P-GEAR-003", product_name: "斜齿轮", planned_quantity: 300, completed_quantity: 300, scrap_quantity: 6, status: "已完成", priority: 1, workshop_code: "WS-02", workshop_name: "二车间（车削）", planned_start_date: offsetDate(-7, 0), planned_end_date: offsetDate(-1, 0), actual_start_date: offsetDate(-7, 0), actual_end_date: offsetDate(-1, 0), customer_name: "中联重科" },
    { order_no: "WO-20240609-001", product_code: "P-FLANGE-004", product_name: "法兰盘", planned_quantity: 250, completed_quantity: 250, scrap_quantity: 3, status: "已关闭", priority: 2, workshop_code: "WS-01", workshop_name: "一车间（精加工）", planned_start_date: offsetDate(-10, 0), planned_end_date: offsetDate(-3, 0), actual_start_date: offsetDate(-10, 0), actual_end_date: offsetDate(-3, 0), customer_name: "三一重工" },
  ];
  await client.from("work_orders").upsert(workOrders, { onConflict: "order_no" });

  // 7. 工序（给生产中的工单填工序）
  console.log("· 工序");
  const { data: woAll } = await client.from("work_orders").select("id, order_no, product_name");
  const woMap = new Map((woAll ?? []).map((w) => [w.order_no, w.id]));

  const operations: Array<{
    work_order_id: string;
    sequence: number;
    operation_name: string;
    workstation: string;
    equipment_code: string;
    standard_time_minutes: number;
    status: string;
    operator_name: string | null;
    good_quantity: number;
    scrap_quantity: number;
  }> = [];
  const opSpec: Record<string, Array<[string, string, string, number]>> = {
    "P-CASE-001": [
      ["粗车", "EQ-LATHE-001", "车一组", 18],
      ["精车", "EQ-LATHE-001", "车二组", 14],
      ["铣削", "EQ-MILL-001", "铣削组", 22],
      ["钻孔", "EQ-DRILL-002", "钻孔组", 12],
    ],
    "P-SHAFT-002": [
      ["下料", "EQ-LATHE-001", "下料组", 8],
      ["车削", "EQ-LATHE-001", "车一组", 25],
      ["铣键槽", "EQ-MILL-001", "铣削组", 18],
      ["磨外圆", "EQ-GRIND-001", "磨一组", 30],
    ],
    "P-GEAR-003": [
      ["粗车", "EQ-LATHE-001", "车二组", 14],
      ["精车", "EQ-LATHE-001", "车二组", 12],
      ["滚齿", "EQ-MILL-001", "滚齿组", 28],
    ],
    "P-FLANGE-004": [
      ["车削", "EQ-LATHE-001", "车一组", 10],
      ["钻孔", "EQ-DRILL-001", "钻孔组", 8],
    ],
    "P-CASE-005": [
      ["粗铣", "EQ-MILL-001", "铣削组", 20],
      ["精铣", "EQ-MILL-001", "铣削组", 25],
      ["钻孔", "EQ-DRILL-001", "钻孔组", 14],
    ],
    "P-PINION-006": [
      ["下料", "EQ-LATHE-001", "下料组", 6],
      ["车削", "EQ-LATHE-001", "车一组", 12],
    ],
  };
  const productByWo = new Map<string, string>();
  workOrders.forEach((w) => productByWo.set(w.order_no, w.product_code));

  const opStatus = (idx: number, total: number) => {
    if (idx < total - 2) return "已完成";
    if (idx === total - 2) return "进行中";
    return "待开始";
  };

  (woAll ?? []).forEach((wo) => {
    const productCode = productByWo.get(wo.order_no);
    if (!productCode) return;
    const route = opSpec[productCode] ?? [];
    route.forEach(([name, eq, ws, std], idx) => {
      const status = opStatus(idx, route.length);
      const isDone = status === "已完成";
      const isDoing = status === "进行中";
      operations.push({
        work_order_id: wo.id,
        sequence: idx + 1,
        operation_name: name,
        workstation: ws,
        equipment_code: eq,
        standard_time_minutes: std,
        status,
        operator_name: isDone || isDoing ? ["张建国", "李志刚", "王海涛", "陈卫东", "赵建军"][idx % 5] : null,
        good_quantity: isDone ? 200 : isDoing ? 50 : 0,
        scrap_quantity: isDone ? 3 : isDoing ? 1 : 0,
      });
    });
  });

  // 清空旧工序后重插（避免重复）
  await client.from("work_order_operations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (operations.length > 0) {
    const { error: opErr } = await client.from("work_order_operations").insert(operations);
    if (opErr) console.warn("工序插入警告:", opErr.message);
  }

  // 8. 报工记录（最近 7 天，每天 1~3 条）
  console.log("· 报工记录");
  const reports: Array<{
    work_order_id: string;
    report_type: string;
    operator_name: string;
    good_quantity: number;
    scrap_quantity: number;
    reported_at: string;
  }> = [];
  const operators = ["张建国", "李志刚", "王海涛", "陈卫东", "赵建军", "刘春明"];
  for (let d = 6; d >= 0; d--) {
    const dayDate = offsetDate(-d, 0).slice(0, 10);
    const reportCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < reportCount; i++) {
      const woEntry = (woAll ?? [])[Math.floor(Math.random() * (woAll?.length ?? 1))];
      if (!woEntry) continue;
      const hour = 8 + Math.floor(Math.random() * 10);
      const min = Math.floor(Math.random() * 60);
      const good = 10 + Math.floor(Math.random() * 40);
      const scrap = Math.random() < 0.25 ? 1 : 0;
      reports.push({
        work_order_id: woEntry.id,
        report_type: scrap > 0 ? "报工" : "完工",
        operator_name: operators[Math.floor(Math.random() * operators.length)],
        good_quantity: good,
        scrap_quantity: scrap,
        reported_at: `${dayDate}T${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`,
      });
    }
  }
  await client.from("work_order_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (reports.length > 0) {
    await client.from("work_order_reports").insert(reports);
  }

  // 9. 设备 OEE（最近 7 天，每台设备每天一条）
  console.log("· 设备 OEE");
  const oeeRows: Array<{
    equipment_code: string;
    record_date: string;
    planned_time_minutes: number;
    run_time_minutes: number;
    downtime_minutes: number;
    good_quantity: number;
    total_quantity: number;
    availability: string;
    performance: string;
    quality: string;
    oee: string;
  }> = [];
  for (let d = 6; d >= 0; d--) {
    const dayDate = offsetDateOnly(-d);
    equipment.forEach((e) => {
      if (e.status === "故障" && d < 2) return;
      const planned = 480;
      const downtime = e.status === "维保中" ? 240 : 20 + Math.floor(Math.random() * 60);
      const run = planned - downtime;
      const avail = (run / planned) * 100;
      const idealCycle = 1.5;
      const produced = Math.floor((run / idealCycle) * (0.7 + Math.random() * 0.25));
      const good = Math.floor(produced * (0.96 + Math.random() * 0.035));
      const qual = (good / Math.max(produced, 1)) * 100;
      const perf = 80 + Math.random() * 15;
      const oee = (avail * perf * qual) / 10000;
      oeeRows.push({
        equipment_code: e.code,
        record_date: dayDate,
        planned_time_minutes: planned,
        run_time_minutes: run,
        downtime_minutes: downtime,
        good_quantity: good,
        total_quantity: produced,
        availability: avail.toFixed(2),
        performance: perf.toFixed(2),
        quality: qual.toFixed(2),
        oee: oee.toFixed(2),
      });
    });
  }
  await client.from("equipment_oee").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (oeeRows.length > 0) {
    const { error: oeeErr } = await client.from("equipment_oee").insert(oeeRows);
    if (oeeErr) console.error("OEE 插入失败:", oeeErr.message);
  }

  // 10. 维保记录
  console.log("· 维保记录");
  const maintenance = [
    { equipment_code: "EQ-LATHE-002", equipment_name: "数控车床 #2", maintenance_type: "定期保养", planned_date: offsetDateOnly(0), status: "执行中", description: "更换主轴润滑油、检查导轨" },
    { equipment_code: "EQ-LATHE-003", equipment_name: "数控车床 #3", maintenance_type: "故障维修", planned_date: offsetDateOnly(0), status: "执行中", description: "X 轴伺服电机异响，需拆检" },
    { equipment_code: "EQ-CNC-003", equipment_name: "CNC加工中心 #3", maintenance_type: "日常点检", planned_date: offsetDateOnly(2), status: "待执行", description: "每月例行点检" },
    { equipment_code: "EQ-MILL-001", equipment_name: "数控铣床 #1", maintenance_type: "定期保养", planned_date: offsetDateOnly(5), status: "待执行", description: "更换冷却液、清理水箱" },
    { equipment_code: "EQ-GRIND-002", equipment_name: "齿轮磨床 #1", maintenance_type: "日常点检", planned_date: offsetDateOnly(7), status: "待执行", description: "检查砂轮磨损情况" },
    { equipment_code: "EQ-DRILL-002", equipment_name: "摇臂钻床 #2", maintenance_type: "定期保养", planned_date: offsetDateOnly(-3), completed_date: offsetDateOnly(-3), operator_name: "马志强", status: "已完成", description: "更换钻套、紧固立柱", cost: "580.00" },
    { equipment_code: "EQ-WIRE-001", equipment_name: "线切割 #1", maintenance_type: "故障维修", planned_date: offsetDateOnly(-5), completed_date: offsetDateOnly(-4), operator_name: "孙建华", status: "已完成", description: "更换钼丝、清理工作液", cost: "1200.00" },
  ];
  await client.from("equipment_maintenance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await client.from("equipment_maintenance").insert(maintenance);

  // 11. 检验记录（最近 7 天）
  console.log("· 检验记录");
  const insp: Array<{
    inspection_no: string;
    work_order_id: string | null;
    work_order_no: string | null;
    inspection_type: string;
    product_code: string;
    product_name: string;
    batch_no: string;
    inspector_name: string;
    inspection_time: string;
    sample_size: number;
    result: string;
    defect_code: string | null;
    defect_description: string | null;
  }> = [];
  const inspectors = ["高玉兰", "宋文斌", "黄志强"];
  let inspSeq = 1;
  for (let d = 6; d >= 0; d--) {
    const dayDate = offsetDate(-d, 0).slice(0, 10);
    const inspCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < inspCount; i++) {
      const woEntry = (woAll ?? [])[Math.floor(Math.random() * (woAll?.length ?? 1))];
      if (!woEntry) continue;
      const isFail = Math.random() < 0.18;
      const sampleSize = 10 + Math.floor(Math.random() * 20);
      const typeChoices = ["首件检验", "巡回检验", "末件检验", "入库检验"];
      insp.push({
        inspection_no: `QI-${dayDate.replace(/-/g, "")}-${inspSeq.toString().padStart(3, "0")}`,
        work_order_id: woEntry.id,
        work_order_no: woEntry.order_no,
        inspection_type: typeChoices[Math.floor(Math.random() * typeChoices.length)],
        product_code: woEntry.product_name === "减速机箱体" ? "P-CASE-001" : woEntry.product_name === "传动主轴" ? "P-SHAFT-002" : woEntry.product_name === "斜齿轮" ? "P-GEAR-003" : woEntry.product_name === "法兰盘" ? "P-FLANGE-004" : "P-CASE-005",
        product_name: woEntry.product_name,
        batch_no: `B${dayDate.replace(/-/g, "")}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
        inspector_name: inspectors[Math.floor(Math.random() * inspectors.length)],
        inspection_time: `${dayDate}T${(9 + Math.floor(Math.random() * 8)).toString().padStart(2, "0")}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")}:00`,
        sample_size: sampleSize,
        result: isFail ? "不合格" : "合格",
        defect_code: isFail ? defectCodes[Math.floor(Math.random() * defectCodes.length)].code : null,
        defect_description: isFail ? "实测值超出图纸公差" : null,
      });
      inspSeq++;
    }
  }
  await client.from("quality_inspections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error: inspErr } = await client.from("quality_inspections").insert(insp);
  if (inspErr) console.error("检验记录插入失败:", inspErr.message);
  if (insp.length > 0) {
    await client.from("quality_inspections").insert(insp);
  }

  console.log("✅ 种子数据播种完成");
}

seed().catch((e) => {
  console.error("种子失败:", e);
  process.exit(1);
});
