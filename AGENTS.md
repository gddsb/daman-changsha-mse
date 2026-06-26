# MES 生产执行系统 - 项目规范

> 机加工行业的制造执行系统（MES），数据源对接用友 U9 ERP，纯 Web 方案。

## 项目概览

- **行业**：机加工（箱体/主轴/齿轮/法兰盘等结构件）
- **核心模块**：工单管理、设备管理、质量管理、生产看板
- **数据源**：U9 ERP（销售订单、物料字典、主生产计划）
- **技术栈**：Next.js 16 (App Router) + React 19 + TypeScript 5 + shadcn/ui + Tailwind CSS 4
- **数据层**：Supabase (PostgreSQL)
- **图表**：Recharts
- **默认端口**：5000

## 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局（暗色主题、Inter + JetBrains Mono 字体）
│   ├── page.tsx                  # 首页 = 生产看板
│   ├── globals.css               # 全局样式（暗色管控台风格）
│   ├── work-orders/
│   │   ├── page.tsx              # 工单列表
│   │   └── [id]/page.tsx         # 工单详情（工序/报工/进度）
│   ├── equipment/page.tsx        # 设备台账
│   ├── quality/page.tsx          # 质量管理
│   └── api/                      # API 路由
│       ├── dashboard/
│       │   ├── summary/route.ts  # 看板汇总
│       │   └── refresh/route.ts  # 看板刷新（模拟实时数据）
│       ├── work-orders/
│       │   ├── route.ts          # 工单列表 + 创建
│       │   ├── [id]/route.ts     # 工单详情 + 状态更新
│       │   └── [id]/reports/route.ts  # 报工
│       ├── equipment/
│       │   ├── route.ts          # 设备列表
│       │   ├── [id]/route.ts     # 设备详情 + 状态更新
│       │   └── maintenance/route.ts  # 维保记录
│       ├── quality/inspections/route.ts  # 检验记录
│       ├── u9/sales-orders/route.ts  # U9 销售订单同步
│       ├── workshops/route.ts    # 车间字典
│       └── products/route.ts     # 物料字典
├── components/
│   ├── layout/                   # 框架
│   │   ├── app-shell.tsx         # 应用外壳（侧边栏 + 顶栏 + 内容区）
│   │   ├── sidebar.tsx           # 左侧导航
│   │   └── topbar.tsx            # 顶栏（实时时钟 + U9 同步按钮）
│   ├── dashboard/                # 看板专用组件
│   │   ├── dashboard-view.tsx    # 看板主视图
│   │   ├── kpi-card.tsx          # KPI 卡片
│   │   ├── output-trend-chart.tsx  # 产量趋势图
│   │   └── equipment-matrix.tsx  # 设备矩阵
│   ├── work-orders/              # 工单模块组件
│   ├── equipment/                # 设备模块组件
│   ├── quality/                  # 质量模块组件
│   ├── shared/
│   │   ├── status-badge.tsx      # 通用状态标签
│   │   └── progress-bar.tsx      # 进度条
│   └── ui/                       # shadcn/ui 预装组件
├── lib/
│   ├── u9-client.ts              # U9 ERP 适配器（mock 数据，标注真实接入点）
│   ├── mes-service.ts            # MES 业务服务层（工单/设备/质量 CRUD）
│   ├── dashboard-service.ts      # 看板数据计算
│   ├── format.ts                 # 数字/日期/百分比格式化
│   ├── constants.ts              # 状态映射、状态色等
│   └── utils.ts                  # cn() 工具
├── types/
│   └── mes.ts                    # 前端 View 层类型（已归一化为英文枚举）
└── storage/database/
    ├── supabase-client.ts        # Supabase 客户端
    └── shared/
        ├── schema.ts             # Drizzle 表结构定义
        ├── types.ts              # 手写 Database 类型（Row/Insert/Update）
        └── relations.ts          # 关系定义

scripts/
└── seed-mes.ts                   # 种子数据脚本（一次性执行，建立示例数据）

DESIGN.md                         # 设计规范（生产管控台风格）
```

## 关键设计决策

### 1. U9 集成（adapter 模式）
- **`src/lib/u9-client.ts`** 是唯一与 U9 对接的入口
- 现状：返回 mock 数据模拟 U9 响应
- **接入真实 U9 时**：
  1. 在 `.env` 配置 `U9_BASE_URL` / `U9_APP_ID` / `U9_APP_SECRET`
  2. 替换 `fetchSalesOrders()` / `fetchProducts()` 内的 mock 块为真实 HTTP 调用
  3. 保持 `U9SalesOrder` / `U9Product` 类型不变 → 上层无感
  4. `U9FieldMap` 注释了 U9 字段 → 本系统字段的映射关系

### 2. 状态值双层映射
- **DB 存储**：中文状态（"生产中"、"已暂停"、"运行中"、"待机"等），便于业务直接读写
- **API/View 返回**：英文枚举（in_progress / running 等），便于前端统一处理
- **映射函数**：`mes-service.ts` 的 `toWorkOrderView` / `toEquipmentView` 等
- **状态显示文案**：`constants.ts` 的 `WO_STATUS_LABELS` / `EQ_STATUS_LABELS`
- **状态色**：`constants.ts` 的 `WO_STATUS_TONES` / `EQ_STATUS_TONES`

### 3. 时区与时间
- DB 存储带时区时间戳
- 前端展示用 `format.ts` 的 `formatDateTime` 等工具
- **严禁在 JSX 中直接 `new Date()` 或 `Date.now()`**（会引发 Hydration 错误）
- 顶栏实时时钟用 `'use client'` + `useEffect` + `useState`

### 4. 暗色主题
- 全站暗色（生产车间监控屏友好）
- 通过 `globals.css` 的 CSS 变量统一管理
- 主色：emerald（成功）/ amber（警告）/ rose（异常）/ sky（信息）
- 强调色：橙色（管控台风格）

## 常用命令

```bash
# 开发
coze dev

# 数据库迁移（修改 schema.ts 后）
coze-coding-ai db upgrade

# ⚠️ 不要执行 db generate-models
# 它会从数据库反向生成 schema.ts，覆盖手写的 Drizzle 定义

# 种子数据
npx tsx scripts/seed-mes.ts

# 类型检查
npx tsc --noEmit

# 验证接口
test_run 工具（pipeline 会自动加 pnpm lint/ts-check + curl）
```

## 数据库表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `workshops` | 车间字典 | code, name |
| `products` | 物料字典（来自 U9） | code, name, specification, process_route |
| `u9_sales_orders` | U9 销售订单缓存 | sales_order_no, customer_name, product_code, quantity |
| `work_orders` | 工单主表 | order_no, planned_quantity, status, workshop_code |
| `work_order_operations` | 工单工序 | work_order_id, sequence, operation_name, status |
| `work_order_reports` | 报工记录 | work_order_id, operator_name, good_quantity |
| `equipment` | 设备台账 | code, type, status, oee_target |
| `equipment_oee` | OEE 历史 | equipment_code, record_date, oee, availability |
| `equipment_maintenance` | 维保记录 | equipment_code, maintenance_type, status |
| `defect_codes` | 不良代码字典 | code, category, severity |
| `quality_inspections` | 质量检验 | inspection_no, work_order_id, result |

## 扩展方向

1. **真实 U9 对接**：按 `u9-client.ts` 注释说明改造
2. **登录与权限**：当前无鉴权；如需权限，参考 supabase-auth 技能
3. **生产排程**：基于 U9 主生产计划 + 设备产能自动排产
4. **物料追溯**：批次号串联工单→检验→入库
5. **大屏可视化**：复用 dashboard 组件做车间大屏
6. **移动端扫码**：用 webrtc-best-practice 技能集成摄像头扫码报工

## 注意事项

- **不要运行 `coze-coding-ai db generate-models`**：会覆盖手写的 `schema.ts`
- 修改 `schema.ts` 后必须执行 `coze-coding-ai db upgrade`
- 修改 `types.ts` 后建议同步修改 `schema.ts`（类型双向一致）
- 状态值务必用 `lib/constants.ts` 的映射表，不要在视图层硬编码
- 所有列表/详情页要支持刷新（看板用 `useEffect` 定时器，列表用 refresh 按钮）
