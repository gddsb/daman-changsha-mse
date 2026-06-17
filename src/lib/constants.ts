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
