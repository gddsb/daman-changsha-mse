/**
 * 工单列表（制罐业务版 · 表格样式）
 * - 表格展示：MO 号 / 产线 / 产品 / 计划量 / 已完成 / 状态 / 计划起止 / 优先级
 * - 顶部新增工单按钮
 * - 双击行打开编辑弹窗（计划数量 / 计划起止日期），开始日期不能小于今天
 * - 新增工单：产品料号可输入筛选 + 返工订单默认原产线
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCcw,
  ClipboardList,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { WO_STATUS_TONE, WO_STATUS_LABELS } from "@/lib/constants";
import type { WorkOrder, Product, ProductionLine } from "@/types/mes";

type SortKey = "order_no" | "product_name" | "line_name" | "quantity" | "completed_quantity" | "status" | "planned_start_date";
type SortDir = "asc" | "desc";

export function WorkOrderListView() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [plannedIds, setPlannedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(["开立", "下发", "生产中", "暂停"]));
  const [lineFilter, setLineFilter] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

  // 排序
  const [sortKey, setSortKey] = useState<SortKey>("planned_start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    try {
      const [res, planRes] = await Promise.all([
        fetch("/api/work-orders", { cache: "no-store" }),
        fetch("/api/production-plans?from=" + sevenDayRange().from + "&to=" + sevenDayRange().to, { cache: "no-store" }),
      ]);
      const json = await res.json();
      const planJson = await planRes.json();
      if (json.success) setOrders(json.data);
      if (planJson.success) {
        setPlannedIds(new Set((planJson.data ?? []).map((p: { work_order_id: string }) => p.work_order_id)));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 计算 [今天, +6天] 的日期范围（UTC）
  function sevenDayRange(): { from: string; to: string } {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const day7 = new Date(today);
    day7.setUTCDate(day7.getUTCDate() + 6);
    return { from: today.toISOString().slice(0, 10), to: day7.toISOString().slice(0, 10) };
  }

  useEffect(() => {
    load();
  }, []);

  const lines = useMemo(() => {
    if (!orders) return [];
    return Array.from(new Set(orders.map((o) => o.line_name).filter(Boolean) as string[]));
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const list = orders.filter((o) => {
      if (statusFilter.size > 0 && !statusFilter.has(o.status)) return false;
      if (lineFilter.size > 0 && !lineFilter.has(o.line_name ?? "")) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          o.order_no.toLowerCase().includes(s) ||
          (o.sales_order_no || "").toLowerCase().includes(s) ||
          o.product_code.toLowerCase().includes(s) ||
          o.product_name.toLowerCase().includes(s)
        );
      }
      return true;
    });
    const cmp = (a: WorkOrder, b: WorkOrder) => {
      const av = (a[sortKey] ?? "") as string | number;
      const bv = (b[sortKey] ?? "") as string | number;
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return sortDir === "asc" ? r : -r;
    };
    return [...list].sort(cmp);
  }, [orders, search, statusFilter, lineFilter, sortKey, sortDir]);

  const summary = useMemo(() => {
    if (!orders) return null;
    return {
      total: orders.length,
      inProgress: orders.filter((o) => o.status === "生产中").length,
      completed: orders.filter((o) => o.status === "完工").length,
      planned: orders.filter((o) => o.status === "开立" || o.status === "下发").length,
    };
  }, [orders]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工单管理</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">U9 同步制罐生产订单 · 13 道连续工序 · 双击行可编辑计划</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              load();
            }}
            disabled={refreshing}
            className="border-border bg-card text-foreground hover:bg-muted"
          >
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-primary text-white hover:bg-primary"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新增工单
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCell label="工单总数" value={summary.total} />
          <SummaryCell label="未下发" value={summary.planned} tone="slate" />
          <SummaryCell label="生产中" value={summary.inProgress} tone="amber" />
          <SummaryCell label="已完成" value={summary.completed} tone="emerald" />
        </div>
      )}

      <Card className="border-border bg-card/60">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索 MO 号 / 销售订单号 / 料号 / 料名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-border bg-background pl-8 text-slate-200 placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 border border-border bg-background/40 px-2 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">状态</span>
              {(["开立", "下发", "生产中", "暂停", "完工", "超期完工"] as const).map((s) => {
                const checked = statusFilter.has(s);
                return (
                  <label key={s} className="flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setStatusFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(s)) next.delete(s);
                          else next.add(s);
                          return next;
                        });
                      }}
                      className="h-3 w-3 cursor-pointer accent-orange-500"
                    />
                    {WO_STATUS_LABELS[s]}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setStatusFilter(new Set())}
                className="ml-1 border border-slate-800 px-1.5 font-mono text-[10px] text-muted-foreground hover:border-slate-600 hover:text-muted-foreground"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 border border-border bg-background/40 px-2 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">产线</span>
              {lines.map((l) => {
                const checked = lineFilter.has(l);
                return (
                  <label key={l} className="flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setLineFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(l)) next.delete(l);
                          else next.add(l);
                          return next;
                        });
                      }}
                      className="h-3 w-3 cursor-pointer accent-orange-500"
                    />
                    {l}
                  </label>
                );
              })}
              <button
                type="button"
                onClick={() => setLineFilter(new Set())}
                className="ml-1 border border-slate-800 px-1.5 font-mono text-[10px] text-muted-foreground hover:border-slate-600 hover:text-muted-foreground"
              >
                清空
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 bg-slate-800/40" />
      ) : filtered.length === 0 ? (
        <Card className="border-border bg-card/60">
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ClipboardList className="h-6 w-6 opacity-30" />
            <p className="text-xs">没有符合条件的工单</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left">
                  <Th onClick={() => toggleSort("order_no")} active={sortKey === "order_no"} dir={sortDir}>MO 号</Th>
                  <Th onClick={() => toggleSort("line_name")} active={sortKey === "line_name"} dir={sortDir}>产线</Th>
                  <Th onClick={() => toggleSort("product_name")} active={sortKey === "product_name"} dir={sortDir}>产品</Th>
                  <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">规格</th>
                  <Th onClick={() => toggleSort("quantity")} active={sortKey === "quantity"} dir={sortDir} align="right">计划(罐)</Th>
                  <Th onClick={() => toggleSort("completed_quantity")} active={sortKey === "completed_quantity"} dir={sortDir} align="right">已完成</Th>
                  <th className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">完工率</th>
                  <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>状态</Th>
                  <Th onClick={() => toggleSort("planned_start_date")} active={sortKey === "planned_start_date"} dir={sortDir}>计划起止</Th>
                  <th className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => (
                  <WorkOrderRow
                    key={wo.id}
                    wo={wo}
                    onClick={() => setEditingOrder(wo)}
                    onDoubleClick={() => setEditingOrder(wo)}
                    hasPlan={plannedIds.has(wo.id)}
                onAction={async (action) => {
                      try {
                        if (action === "delete") {
                          if (!confirm(`确认删除工单 ${wo.order_no}？该操作不可恢复。`)) return;
                          const res = await fetch(`/api/work-orders/${wo.id}`, { method: "DELETE" });
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok || !j.success) throw new Error(j.error || "删除失败");
                          await load();
                          return;
                        }
                        const res = await fetch(`/api/work-orders/${wo.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action }),
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok || !j.success) throw new Error(j.error || `${action} 失败`);
                        await load();
                      } catch (e) {
                        alert((e as Error).message);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreate && (
        <CreateWorkOrderDialog
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {editingOrder && (
        <EditWorkOrderDialog
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={async () => {
            setEditingOrder(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Th({
  children, onClick, active, dir, align = "left",
}: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; dir?: SortDir; align?: "left" | "right" | "center";
}) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider ${
        onClick ? "cursor-pointer select-none hover:text-slate-200" : ""
      } ${active ? "text-orange-400" : "text-muted-foreground"} ${alignCls}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}

function WorkOrderRow({
  wo,
  onClick,
  onDoubleClick,
  onAction,
  hasPlan,
}: {
  wo: WorkOrder;
  onClick: () => void;
  onDoubleClick: () => void;
  onAction: (action: "release" | "start" | "delete" | "complete" | "pause") => void;
  hasPlan: boolean;
}) {
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  const tone = WO_STATUS_TONE[wo.status] ?? "border-border text-slate-400";
  const st = wo.status;
  const canRelease = st === "开立";
  const canStart = (st === "下发" || st === "暂停") && hasPlan;
  const canPause = st === "生产中";
  const canDelete = st === "开立" || st === "下发";
  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title="单击 / 双击打开工单修改"
      className="cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-900/80"
    >
      <td className="px-3 py-2 font-mono text-[11px] text-orange-400">{wo.order_no}</td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{wo.line_name ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="truncate text-xs text-slate-200" title={wo.product_name}>{wo.product_name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{wo.product_code}</div>
      </td>
      <td className="px-3 py-2 text-slate-400">{wo.specification && wo.specification !== "—" ? wo.specification : "—"}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">{wo.quantity.toLocaleString()}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-300">{wo.completed_quantity.toLocaleString()}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{rate.toFixed(1)}%</span>
          <div className="h-1 w-12 overflow-hidden bg-slate-800">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, rate)}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className={`font-mono text-[10px] ${tone}`}>{WO_STATUS_LABELS[wo.status]}</Badge>
      </td>
      <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
        <div>{formatDate(wo.planned_start_date)}</div>
        <div className="text-muted-foreground">~ {formatDate(wo.planned_end_date)}</div>
      </td>
      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {canRelease && (
            <button
              onClick={() => onAction("release")}
              className="border border-sky-500/50 px-1.5 py-0.5 font-mono text-[10px] text-sky-300 hover:bg-sky-500/15"
            >
              下发
            </button>
          )}
          {canStart && (
            <button
              onClick={() => onAction("start")}
              className="border border-orange-500/50 px-1.5 py-0.5 font-mono text-[10px] text-orange-300 hover:bg-primary/15"
            >
              {st === "暂停" ? "重新开工" : "开工"}
            </button>
          )}
          {canPause && (
            <button
              onClick={() => onAction("pause")}
              className="border border-yellow-500/50 px-1.5 py-0.5 font-mono text-[10px] text-yellow-300 hover:bg-yellow-500/15"
            >
              暂停
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onAction("delete")}
              className="border border-rose-500/40 px-1.5 py-0.5 font-mono text-[10px] text-rose-300 hover:bg-rose-500/15"
            >
              删除
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * 产品料号可输入筛选下拉（替代原生 <select>）
 * - 用户在输入框里键入字符 → 实时从 products 列表中按 code/name/specification 模糊匹配
 * - 选中后回填 product_name / specification / default_line_code
 */
function ProductCodeCombobox({
  products,
  value,
  onChange,
  onResolved,
}: {
  products: Product[];
  value: string;
  onChange: (v: string) => void;
  onResolved?: (p: Product | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const q = value.toLowerCase();
  const matched = useMemo(() => {
    if (!q) return products.slice(0, 30);
    return products
      .filter((p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.specification || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [q, products]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(p: Product) {
    onChange(p.code);
    onResolved?.(p);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(matched.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" && matched[highlight]) {
            e.preventDefault();
            pick(matched[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="输入料号/料名/规格关键字筛选"
        className="border-border bg-card font-mono text-xs text-slate-200 placeholder:text-muted-foreground"
      />
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto border border-border bg-slate-950 shadow-lg">
          {matched.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">无匹配产品，可在参数设置中新增</div>
          )}
          {matched.map((p, i) => (
            <button
              key={p.code}
              type="button"
              onClick={() => pick(p)}
              onMouseEnter={() => setHighlight(i)}
              className={`block w-full border-b border-slate-800/60 px-3 py-1.5 text-left text-xs transition ${
                i === highlight ? "bg-slate-800/80" : "hover:bg-slate-900"
              }`}
            >
              <div className="font-mono text-orange-300">{p.code}</div>
              <div className="mt-0.5 truncate text-muted-foreground">
                {p.name}
                {p.specification && p.specification !== "—" && (
                  <span className="ml-2 text-muted-foreground">· {p.specification}</span>
                )}
                {p.default_line_name && (
                  <span className="ml-2 text-muted-foreground">· 默认 {p.default_line_name}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 新增工单弹窗
 * - 产品料号可输入筛选
 * - 选中产品后自动带入产品名称 / 规格 / 默认产线
 * - 订单类型=返工时，默认产线=当前工单来源产线（这里以 products.default_line_name 为兜底）
 */
function CreateWorkOrderDialog({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNoAuto, setOrderNoAuto] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    order_no: "",
    product_code: "",
    product_name: "",
    specification: "",
    planned_quantity: "",
    line_code: "",
    order_type: "制罐生产订单",
    rework_source_line_name: "",
    customer_name: "",
    planned_start_date: today,
    planned_end_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    notes: "",
  });

  // MO 号预览：根据当天日期 + 现有工单最大流水 + 1 生成
  const orderNoPreview = useMemo(() => {
    const d = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    return `MO-16${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}___`;
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/production-lines").then((r) => r.json()),
    ]).then(([p, l]) => {
      if (p.success) setProducts(p.data);
      if (l.success) setLines(l.data);
    });
  }, []);

  async function fillNextOrderNo() {
    try {
      const res = await fetch("/api/work-orders/next-order-no");
      const json = await res.json();
      if (json.success && json.data) {
        setForm((f) => ({ ...f, order_no: json.data }));
        setOrderNoAuto(false);
      }
    } catch {
      /* ignore */
    }
  }

  /** 选中产品后自动带入产品名称/规格/默认产线；返工订单锁定为原产线 */
  // 把"短产线码"（A/B）归一化为数据库用的"LINE-A/LINE-B"
  const normalizeLineCode = (code: string | null | undefined): string => {
    if (!code) return "";
    const c = code.trim();
    if (c.toUpperCase() === "A" || c.toUpperCase() === "B") return `LINE-${c.toUpperCase()}`;
    return c;
  };

  function onProductPicked(p: Product | null) {
    if (!p) return;
    setForm((f) => {
      const spec = p.specification && p.specification !== "—" ? p.specification : "";
      const lineCode = normalizeLineCode(p.default_line_code);
      const lineName = p.default_line_name ||
        (lineCode === "LINE-A" ? "A线" : lineCode === "LINE-B" ? "B线" : "");
      const next: typeof f = { ...f, product_name: p.name, specification: spec };
      if (f.order_type === "返工") {
        // 返工订单保持原产线，未填则使用产品的默认产线
        if (!f.line_code && lineCode) {
          next.line_code = lineCode;
          next.rework_source_line_name = lineName;
        }
      } else {
        if (lineCode) {
          next.line_code = lineCode;
          next.rework_source_line_name = "";
        }
      }
      return next;
    });
  }

  function changeOrderType(t: string) {
    setForm((f) => {
      const next = { ...f, order_type: t };
      if (t === "返工") {
        // 切到返工时，记录当前产线为原产线（如果已选），且不再自动覆盖
        if (f.line_code) {
          const ln = lines.find((l) => l.code === f.line_code);
          next.rework_source_line_name = ln?.name || f.rework_source_line_name;
        }
      } else {
        next.rework_source_line_name = "";
      }
      return next;
    });
  }

  async function submit() {
    if (!form.product_code || !form.planned_quantity || !form.line_code) {
      setError("请选择产品、产线并填写计划数量");
      return;
    }
    if (Number(form.planned_quantity) <= 0) {
      setError("计划数量必须大于 0");
      return;
    }
    if (form.planned_start_date < today) {
      setError("计划开始日期不能小于当前日期");
      return;
    }
    const trimmedOrderNo = form.order_no.trim();
    if (trimmedOrderNo && !/^MO-16\d{9}$/.test(trimmedOrderNo)) {
      setError("MO 号格式不正确，应为 MO-16+两位年+两位月+两位日+三位流水，如 MO-16260617003");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_no: trimmedOrderNo || undefined,
          product_code: form.product_code,
          product_name: form.product_name,
          specification: form.specification || null,
          planned_quantity: Number(form.planned_quantity),
          line_code: form.line_code,
          order_type: form.order_type,
          customer_name: form.customer_name || null,
          planned_start_date: new Date(form.planned_start_date).toISOString(),
          planned_end_date: new Date(form.planned_end_date).toISOString(),
          notes: form.notes || null,
        }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : { success: false, error: `HTTP ${res.status}` };
      if (json.success) {
        await onCreated();
      } else {
        setError(json.error || "创建失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-2xl border-border bg-background">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-mono text-sm font-semibold text-foreground">新增工单</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <CardContent className="space-y-3 p-4">
          <Field
            label={
              <span className="flex items-center gap-2">
                MO 号
                <span className="font-mono text-[10px] text-muted-foreground">
                  {orderNoAuto ? "(留空将自动按 MO-16+YYMMDD+流水 生成)" : "(已手动填写)"}
                </span>
              </span>
            }
          >
            <div className="flex gap-2">
              <Input
                value={form.order_no}
                onChange={(e) => {
                  setForm({ ...form, order_no: e.target.value });
                  setOrderNoAuto(e.target.value.trim().length === 0);
                }}
                placeholder={orderNoPreview}
                className="flex-1 border-border bg-card font-mono text-slate-200"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={fillNextOrderNo}
                className="border-border bg-slate-900 font-mono text-[11px] text-muted-foreground hover:border-orange-500/60 hover:text-orange-300"
                title="取下一个 MO 号填入"
              >
                自动生成
              </Button>
            </div>
          </Field>

          <Field label="产品料号（输入筛选）" required>
            <ProductCodeCombobox
              products={products}
              value={form.product_code}
              onChange={(v) => {
                setForm({ ...form, product_code: v });
                const p = products.find((x) => x.code === v);
                if (p) onProductPicked(p);
              }}
              onResolved={onProductPicked}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="产品名称（自动带入）" required>
              <Input
                value={form.product_name}
                readOnly
                className="cursor-not-allowed border-border bg-card/40 text-slate-400"
                placeholder="选择料号后自动带入"
              />
            </Field>
            <Field label="规格（自动带入）">
              <Input
                value={form.specification}
                readOnly
                className="cursor-not-allowed border-border bg-card/40 text-slate-400"
                placeholder="选择料号后自动带入"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="计划数量 (罐)" required>
              <Input
                type="number"
                min={1}
                value={form.planned_quantity}
                onChange={(e) => setForm({ ...form, planned_quantity: e.target.value })}
                placeholder="0"
                className="border-border bg-card text-slate-200"
              />
            </Field>
            <Field label="产线（自动带入）" required>
              <select
                value={form.line_code}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    line_code: e.target.value,
                    rework_source_line_name:
                      f.order_type === "返工"
                        ? (lines.find((l) => l.code === e.target.value)?.name || f.rework_source_line_name)
                        : f.rework_source_line_name,
                  }));
                }}
                disabled={form.order_type === "返工" ? false : true}
                className="h-9 w-full cursor-not-allowed rounded-sm border border-border bg-card/40 px-2 font-mono text-xs text-slate-400 outline-none focus:border-orange-500 disabled:opacity-70"
              >
                <option value="">请选择产线</option>
                {lines.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                    {form.order_type === "返工" && l.name === form.rework_source_line_name ? " · 原产线" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="计划开始日期" required>
              <Input
                type="date"
                min={today}
                value={form.planned_start_date}
                onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
                className="border-border bg-card text-slate-200"
              />
            </Field>
            <Field label="计划结束日期" required>
              <Input
                type="date"
                min={form.planned_start_date}
                value={form.planned_end_date}
                onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
                className="border-border bg-card text-slate-200"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="订单类型">
              <select
                value={form.order_type}
                onChange={(e) => changeOrderType(e.target.value)}
                className="h-9 w-full rounded-sm border border-border bg-card px-2 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
              >
                <option value="制罐生产订单">制罐生产订单</option>
                <option value="返工">返工</option>
                <option value="试制">试制</option>
              </select>
            </Field>
            <Field label="客户名称">
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="border-border bg-card text-slate-200"
              />
            </Field>
          </div>

          {form.order_type === "返工" && form.rework_source_line_name && (
            <div className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              返工订单：默认原产线 <span className="font-mono text-amber-200">{form.rework_source_line_name}</span>（不可修改）
            </div>
          )}

          <Field label="备注">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-sm border border-border bg-card px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
            />
          </Field>

          {error && (
            <div className="border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={submit} disabled={submitting} className="bg-primary text-white hover:bg-primary">
              {submitting ? "创建中..." : "创建工单"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 双击工单行打开：编辑计划数量 / 计划开始 / 计划完成
 * - 计划开始日期不能小于今天
 * - 已开工/已完工的工单：可调整但不改工序实际进度
 */
function EditWorkOrderDialog({
  order, onClose, onSaved,
}: { order: WorkOrder; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    planned_quantity: String(order.quantity),
    planned_start_date: order.planned_start_date ? order.planned_start_date.slice(0, 10) : today,
    planned_end_date: order.planned_end_date ? order.planned_end_date.slice(0, 10) : today,
  });

  async function submit() {
    const q = Number(form.planned_quantity);
    if (!q || q <= 0) { setError("计划数量必须大于 0"); return; }
    if (form.planned_start_date < today) { setError("计划开始日期不能小于当前日期"); return; }
    if (form.planned_end_date < form.planned_start_date) { setError("计划完成日期不能小于开始日期"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`/api/work-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planned_quantity: q,
          planned_start_date: new Date(form.planned_start_date).toISOString(),
          planned_end_date: new Date(form.planned_end_date).toISOString(),
        }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : { success: false, error: `HTTP ${res.status}` };
      if (json.success) {
        await onSaved();
      } else {
        setError(json.error || "保存失败");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onDoubleClick={(e) => e.stopPropagation()}>
      <Card className="w-full max-w-md border-border bg-background">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="font-mono text-sm font-semibold text-foreground">编辑工单计划</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{order.order_no} · {order.product_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="当前状态">
              <div className="flex h-9 items-center border border-border bg-card px-2 text-xs text-muted-foreground">
                {WO_STATUS_LABELS[order.status] ?? order.status}
              </div>
            </Field>
            <Field label="产线">
              <div className="flex h-9 items-center border border-border bg-card px-2 text-xs text-muted-foreground">
                {order.line_name ?? "—"}
              </div>
            </Field>
            <Field label="已完成/计划">
              <div className="flex h-9 items-center border border-border bg-card px-2 font-mono text-xs text-muted-foreground">
                {order.completed_quantity.toLocaleString()} / {order.quantity.toLocaleString()}
              </div>
            </Field>
          </div>

          <Field label="计划数量 (罐)" required>
            <Input
              type="number"
              min={1}
              value={form.planned_quantity}
              onChange={(e) => setForm({ ...form, planned_quantity: e.target.value })}
              className="border-border bg-card text-slate-200"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="计划开始日期" required>
              <Input
                type="date"
                min={today}
                value={form.planned_start_date}
                onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
                className="border-border bg-card text-slate-200"
              />
            </Field>
            <Field label="计划完成日期" required>
              <Input
                type="date"
                min={form.planned_start_date}
                value={form.planned_end_date}
                onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
                className="border-border bg-card text-slate-200"
              />
            </Field>
          </div>

          {error && <div className="border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={submit} disabled={submitting} className="bg-primary text-white hover:bg-primary">
              {submitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: React.ReactNode; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-muted-foreground">
        {label}{required && <span className="ml-1 text-rose-400">*</span>}
      </div>
      {children}
    </div>
  );
}

function SummaryCell({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" | "emerald" }) {
  const color = { slate: "text-slate-200", amber: "text-amber-400", emerald: "text-emerald-400" }[tone];
  return (
    <div className="border border-border bg-card/60 p-3">
      <div className={`font-mono text-2xl tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-0.5 font-mono text-[10px] transition ${
        active
          ? "border-orange-500/60 bg-primary/10 text-orange-300"
          : "border-border bg-card text-slate-400 hover:border-border hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
