/**
 * 通用格式化工具
 */

export function formatNumber(
  n: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("zh-CN", options).format(n);
}

export function formatPercent(
  n: number | null | undefined,
  fractionDigits = 1,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(fractionDigits)}%`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 相对时间显示，如 "刚刚" / "5 分钟前" / "2 小时前" / "3 天前" */
export function formatRelativeTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(date);
}

export function diffMinutes(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): number {
  if (!start || !end) return 0;
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 60000));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 生成工单号 WO-YYYYMMDD-XXX */
export function generateWorkOrderNo(seq: number): string {
  const d = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `WO-${date}-${pad(seq, 3)}`;
}

/** 生成报工单号 RPT-YYYYMMDDHHmmss-XXXX */
export function generateReportNo(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  const t = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `RPT-${t}-${rand}`;
}

/** 生成检验单号 QI-YYYYMMDD-XXX */
export function generateInspectionNo(seq: number): string {
  const d = new Date();
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `QI-${date}-${pad(seq, 3)}`;
}
