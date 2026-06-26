/**
 * U9 ERP 适配器
 *
 * 现状：U9 OpenAPI 未对接，使用 mock 数据模拟 U9 同步行为。
 * 切换为真实 U9 调用时：
 * 1. 在 process.env 配置 U9_BASE_URL / U9_APP_ID / U9_APP_SECRET
 * 2. 替换 fetchSalesOrders / fetchProducts 实现内的 mock 块为真实 HTTP 请求
 * 3. 字段映射见下方 U9FieldMap，保持 U9SalesOrder/U9Product 类型不变即可
 */

export interface U9SalesOrder {
  salesOrderNo: string;
  customerCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  deliveryDate: string; // YYYY-MM-DD
  status: string;
}

export interface U9Product {
  code: string;
  name: string;
  specification: string;
  unit: string;
  processRoute: string;
}

export interface U9FieldMap {
  /** U9 字段 → 本系统字段 */
  salesOrder: {
    DocNo: "salesOrderNo";
    Customer_Code: "customerCode";
    Customer_Name: "customerName";
    ItemMaster_Code: "productCode";
    ItemMaster_Name: "productName";
    Qty: "quantity";
    UOM: "unit";
    DeliveryDate: "deliveryDate";
    Status: "status";
  };
  product: {
    Code: "code";
    Name: "name";
    Specification: "specification";
    UOM: "unit";
    ProcessRoute: "processRoute";
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 模拟 U9 销售订单数据
 * 真实场景下，U9 OpenAPI 调用形如：
 *   GET {U9_BASE_URL}/api/v1/SalesOrder/List?lastSyncTime=...
 *   Header: Authorization: Bearer {access_token}
 */
async function fetchSalesOrdersFromU9(): Promise<U9SalesOrder[]> {
  // 模拟网络延迟
  await sleep(150);

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const offset = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return fmt(d);
  };

  return [
    {
      salesOrderNo: "SO-2024-0612-001",
      customerCode: "C001",
      customerName: "三一重工",
      productCode: "P-CASE-001",
      productName: "减速机箱体",
      quantity: 200,
      unit: "件",
      deliveryDate: offset(7),
      status: "已审核",
    },
    {
      salesOrderNo: "SO-2024-0612-002",
      customerCode: "C002",
      customerName: "徐工集团",
      productCode: "P-SHAFT-002",
      productName: "传动主轴",
      quantity: 150,
      unit: "件",
      deliveryDate: offset(10),
      status: "已审核",
    },
    {
      salesOrderNo: "SO-2024-0613-001",
      customerCode: "C003",
      customerName: "中联重科",
      productCode: "P-GEAR-003",
      productName: "斜齿轮",
      quantity: 500,
      unit: "件",
      deliveryDate: offset(14),
      status: "已审核",
    },
    {
      salesOrderNo: "SO-2024-0613-002",
      customerCode: "C001",
      customerName: "三一重工",
      productCode: "P-FLANGE-004",
      productName: "法兰盘",
      quantity: 300,
      unit: "件",
      deliveryDate: offset(5),
      status: "已审核",
    },
    {
      salesOrderNo: "SO-2024-0614-001",
      customerCode: "C004",
      customerName: "潍柴动力",
      productCode: "P-CASE-005",
      productName: "发动机壳体",
      quantity: 100,
      unit: "件",
      deliveryDate: offset(20),
      status: "已审核",
    },
    {
      salesOrderNo: "SO-2024-0614-002",
      customerCode: "C005",
      customerName: "柳工机械",
      productCode: "P-PINION-006",
      productName: "小齿轮",
      quantity: 800,
      unit: "件",
      deliveryDate: offset(12),
      status: "已审核",
    },
  ];
}

/**
 * 模拟 U9 物料字典
 */
async function fetchProductsFromU9(): Promise<U9Product[]> {
  await sleep(100);
  return [
    { code: "P-CASE-001", name: "减速机箱体", specification: "HT250 / 380×280×180", unit: "件", processRoute: "粗车→精车→铣削→钻孔→钳工去毛刺→检验" },
    { code: "P-SHAFT-002", name: "传动主轴", specification: "45# / φ80×620", unit: "件", processRoute: "下料→车削→铣键槽→磨外圆→热处理→精磨→检验" },
    { code: "P-GEAR-003", name: "斜齿轮", specification: "20CrMnTi / m=3 z=42", unit: "件", processRoute: "锻造→粗车→精车→滚齿→倒角→热处理→磨齿→检验" },
    { code: "P-FLANGE-004", name: "法兰盘", specification: "Q235 / φ200×30", unit: "件", processRoute: "下料→车削→钻孔→去毛刺→检验" },
    { code: "P-CASE-005", name: "发动机壳体", specification: "HT200 / 450×320×210", unit: "件", processRoute: "粗铣→精铣→钻孔→攻丝→清洗→检验" },
    { code: "P-PINION-006", name: "小齿轮", specification: "40Cr / m=2 z=20", unit: "件", processRoute: "下料→车削→滚齿→热处理→磨齿→检验" },
  ];
}

export const u9Client = {
  fetchSalesOrders: fetchSalesOrdersFromU9,
  fetchProducts: fetchProductsFromU9,
};
