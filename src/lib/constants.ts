/**
 * 共享常量定义
 * value: 存储/枚举值（英文/拼音）   label: 界面展示文案（中文）
 */

export interface SelectOption<V = string> {
  value: V;
  label: string;
}

// 工单状态
export const WORK_ORDER_STATUS: Record<string, string> = {
  planned: "计划中",
  released: "已下发",
  in_progress: "生产中",
  paused: "已暂停",
  completed: "已完成",
  closed: "已关闭",
};

export const WORK_ORDER_STATUS_OPTIONS: SelectOption[] = [
  { value: "planned", label: "计划中" },
  { value: "released", label: "已下发" },
  { value: "in_progress", label: "生产中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
  { value: "closed", label: "已关闭" },
];

// 优先级
export const WORK_ORDER_PRIORITY_OPTIONS: SelectOption<number>[] = [
  { value: 1, label: "P1 紧急" },
  { value: 2, label: "P2 高" },
  { value: 3, label: "P3 中" },
  { value: 4, label: "P4 低" },
  { value: 5, label: "P5 最低" },
];

// 设备状态
export const EQUIPMENT_STATUS: Record<string, string> = {
  running: "运行中",
  idle: "待机",
  maintenance: "维保中",
  breakdown: "故障",
  offline: "离线",
};

export const EQUIPMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: "running", label: "运行中" },
  { value: "idle", label: "待机" },
  { value: "maintenance", label: "维保中" },
  { value: "breakdown", label: "故障" },
];

// 设备类型
export const EQUIPMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "cnc", label: "CNC加工中心" },
  { value: "lathe", label: "数控车床" },
  { value: "mill", label: "数控铣床" },
  { value: "grinder", label: "磨床" },
  { value: "drill", label: "钻床" },
  { value: "wire_edm", label: "线切割" },
  { value: "edm", label: "电火花" },
  { value: "other", label: "其他" },
];

// 工序状态
export const OPERATION_STATUS: Record<string, string> = {
  pending: "待开始",
  in_progress: "进行中",
  completed: "已完成",
  paused: "已暂停",
};

// 报工类型
export const REPORT_TYPE: Record<string, string> = {
  start: "开工",
  pause: "暂停",
  resume: "复工",
  complete: "完工",
  production: "生产报工",
};

export const REPORT_TYPE_OPTIONS: SelectOption[] = [
  { value: "start", label: "开工" },
  { value: "pause", label: "暂停" },
  { value: "resume", label: "复工" },
  { value: "complete", label: "完工" },
  { value: "production", label: "生产报工" },
];

// 维护类型
export const MAINTENANCE_TYPE: Record<string, string> = {
  routine: "日常点检",
  preventive: "定期保养",
  corrective: "故障维修",
  predictive: "预测性维护",
};

export const MAINTENANCE_TYPE_OPTIONS: SelectOption[] = [
  { value: "routine", label: "日常点检" },
  { value: "preventive", label: "定期保养" },
  { value: "corrective", label: "故障维修" },
  { value: "predictive", label: "预测性维护" },
];

// 维护状态
export const MAINTENANCE_STATUS: Record<string, string> = {
  planned: "待执行",
  in_progress: "执行中",
  completed: "已完成",
  overdue: "已逾期",
  cancelled: "已取消",
};

// 检验类型
export const INSPECTION_TYPE: Record<string, string> = {
  first: "首件检验",
  in_process: "巡回检验",
  final: "末件检验",
  incoming: "入库检验",
};

export const INSPECTION_TYPE_OPTIONS: SelectOption[] = [
  { value: "first", label: "首件检验" },
  { value: "in_process", label: "巡回检验" },
  { value: "final", label: "末件检验" },
  { value: "incoming", label: "入库检验" },
];

// 检验结果
export const INSPECTION_RESULT: Record<string, string> = {
  pass: "合格",
  fail: "不合格",
  conditional: "让步接收",
};

export const INSPECTION_RESULT_OPTIONS: SelectOption[] = [
  { value: "pass", label: "合格" },
  { value: "fail", label: "不合格" },
  { value: "conditional", label: "让步接收" },
];

// 兼容旧命名
export const QUALITY_RESULT_OPTIONS = INSPECTION_RESULT_OPTIONS;

// 不良类别
export const DEFECT_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "dimension", label: "尺寸超差" },
  { value: "geometry", label: "形位公差" },
  { value: "appearance", label: "表面缺陷" },
  { value: "material", label: "材质异常" },
  { value: "assembly", label: "装配异常" },
  { value: "other", label: "其他" },
];

// 不良严重度
export const DEFECT_SEVERITY_OPTIONS: SelectOption[] = [
  { value: "critical", label: "严重" },
  { value: "major", label: "一般" },
  { value: "minor", label: "轻微" },
];

// 工单状态色调（badge 用）
export const WO_STATUS_TONE: Record<string, string> = {
  planned: "border-slate-700 bg-slate-800/40 text-slate-300",
  released: "border-sky-700/50 bg-sky-900/30 text-sky-400",
  in_progress: "border-amber-700/50 bg-amber-900/30 text-amber-400",
  paused: "border-orange-700/50 bg-orange-900/30 text-orange-400",
  completed: "border-emerald-700/50 bg-emerald-900/30 text-emerald-400",
  closed: "border-slate-700 bg-slate-900/40 text-slate-500",
};

// 工单状态中文标签（视图层直接用）
export const WO_STATUS_LABELS: Record<string, string> = {
  planned: "计划中",
  released: "已下发",
  in_progress: "生产中",
  paused: "已暂停",
  completed: "已完成",
  closed: "已关闭",
};

// 工序状态色调（中文状态）
export const PROCESS_STATUS_TONE: Record<string, string> = {
  待开始: "border-slate-700 bg-slate-900/40 text-slate-300",
  进行中: "border-amber-700/50 bg-amber-900/30 text-amber-400",
  已完成: "border-emerald-700/50 bg-emerald-900/30 text-emerald-400",
  已暂停: "border-rose-700/50 bg-rose-900/30 text-rose-400",
};

export const PROCESS_STATUS_LABELS: Record<string, string> = {
  待开始: "待开始",
  进行中: "进行中",
  已完成: "已完成",
  已暂停: "已暂停",
};

// 检验类型
export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  first: "首件",
  in_process: "巡检",
  final: "末件",
  outgoing: "入库检",
};

// 检验结果色调
export const INSPECTION_RESULT_TONE: Record<string, string> = {
  pass: "border-emerald-700/50 bg-emerald-900/30 text-emerald-400",
  fail: "border-rose-700/50 bg-rose-900/30 text-rose-400",
  conditional: "border-amber-700/50 bg-amber-900/30 text-amber-400",
};

// 优先级色调
export const PRIORITY_TONE: Record<number, string> = {
  1: "border-rose-700/50 bg-rose-900/30 text-rose-400",
  2: "border-orange-700/50 bg-orange-900/30 text-orange-400",
  3: "border-slate-700 bg-slate-900/40 text-slate-300",
  4: "border-slate-800 bg-slate-900/40 text-slate-500",
  5: "border-slate-800 bg-slate-900/40 text-slate-600",
};

// ====== 制罐行业专有常量（长沙大满） ======

// 13 道固定工序（按用户提供的顺序）
export const CAN_PROCESSES = [
  { code: "P01", name: "下料" },
  { code: "P02", name: "小料检测" },
  { code: "P03", name: "焊接" },
  { code: "P04", name: "补图烘干" },
  { code: "P05", name: "封口" },
  { code: "P06", name: "测漏" },
  { code: "P07", name: "离子风" },
  { code: "P08", name: "卷封光检" },
  { code: "P09", name: "倒罐光检" },
  { code: "P10", name: "罐内光检" },
  { code: "P11", name: "全检" },
  { code: "P12", name: "码垛" },
  { code: "P13", name: "包装" },
] as const;

export const CAN_PROCESS_NAMES = CAN_PROCESSES.map((p) => p.name);

// 产线
export const PRODUCTION_LINES = [
  { code: "LINE-A", name: "A线" },
  { code: "LINE-B", name: "B线" },
] as const;

// 班次
export const SHIFT_OPTIONS: SelectOption[] = [
  { value: "白班", label: "白班" },
  { value: "夜班", label: "夜班" },
];

// 单据状态（来自 U9 业务）
export const U9_DOC_STATUS = {
  开立: "开立",
  开工: "开工",
  完工: "完工",
  关闭: "关闭",
} as const;

export const U9_STATUS_MAP: Record<string, string> = {
  开立: "released",
  开工: "in_progress",
  完工: "completed",
  关闭: "closed",
};

export const U9_STATUS_REVERSE: Record<string, string> = {
  released: "开立",
  in_progress: "开工",
  completed: "完工",
  closed: "关闭",
  paused: "已暂停",
};

// 七天滚动计划状态
export const PLAN_STATUS: Record<string, string> = {
  scheduled: "已排",
  in_progress: "执行中",
  done: "已完成",
  hold: "挂起",
  cancel: "取消",
};

export const PLAN_STATUS_OPTIONS: SelectOption[] = [
  { value: "scheduled", label: "已排" },
  { value: "in_progress", label: "执行中" },
  { value: "done", label: "已完成" },
  { value: "hold", label: "挂起" },
  { value: "cancel", label: "取消" },
];

// 班次色调
export const SHIFT_TONE: Record<string, string> = {
  白班: "border-slate-700 bg-slate-900/40 text-slate-300",
  夜班: "border-indigo-700/50 bg-indigo-900/30 text-indigo-400",
};

// 检验结果标签
export const INSPECTION_RESULT_LABELS: Record<string, string> = {
  pass: "合格",
  fail: "不合格",
  conditional: "让步接收",
};

// 计划状态标签
export const PLAN_STATUS_LABELS: Record<string, string> = {
  scheduled: "已排",
  in_progress: "执行中",
  done: "已完成",
  hold: "挂起",
  cancel: "取消",
};

// 工序顺序（13 道）
export const PROCESS_SEQUENCE: Array<{ key: string; name: string; order: number }> = [
  { key: "下料", name: "下料", order: 1, },
  { key: "小料检测", name: "小料检测", order: 2, },
  { key: "焊接", name: "焊接", order: 3, },
  { key: "补图烘干", name: "补图烘干", order: 4, },
  { key: "封口", name: "封口", order: 5, },
  { key: "测漏", name: "测漏", order: 6, },
  { key: "离子风", name: "离子风", order: 7, },
  { key: "卷封光检", name: "卷封光检", order: 8, },
  { key: "倒罐光检", name: "倒罐光检", order: 9, },
  { key: "罐内光检", name: "罐内光检", order: 10, },
  { key: "全检", name: "全检", order: 11, },
  { key: "码垛", name: "码垛", order: 12, },
  { key: "包装", name: "包装", order: 13, },
];
