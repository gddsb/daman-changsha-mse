/**
 * 工单列表（制罐业务版 · 表格样式）
 * - 表格展示：MO 号 / 产线 / 产品 / 计划量 / 已完成 / 状态 / 计划起止 / 优先级
 * - 顶部新增工单按钮
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

type SortKey = "order_no" | "product_name" | "line_name" | "quantity" | "completed_quantity" | "status" | "planned_start_date" | "priority";
type SortDir = "asc" | "desc";

export function WorkOrderListView() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // 排序
  const [sortKey, setSortKey] = useState<SortKey>("planned_start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    try {
      const res = await fetch("/api/work-orders", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (lineFilter !== "all" && o.line_name !== lineFilter) return false;
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
    // 排序
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
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      completed: orders.filter((o) => o.status === "completed").length,
      planned: orders.filter((o) => o.status === "planned" || o.status === "released").length,
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
          <h1 className="text-xl font-semibold text-slate-100">工单管理</h1>
          <p className="mt-0.5 text-xs text-slate-500">U9 同步制罐生产订单 · 13 道连续工序</p>
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
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新增工单
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCell label="工单总数" value={summary.total} />
          <SummaryCell label="未开工" value={summary.planned} tone="slate" />
          <SummaryCell label="生产中" value={summary.inProgress} tone="amber" />
          <SummaryCell label="已完成" value={summary.completed} tone="emerald" />
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/60">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="搜索 MO 号 / 销售订单号 / 料号 / 料名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-slate-800 bg-slate-950 pl-8 text-slate-200 placeholder:text-slate-600"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="全部状态"
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              {(["planned", "released", "in_progress", "paused", "completed", "closed"] as const).map(
                (s) => (
                  <FilterChip
                    key={s}
                    label={WO_STATUS_LABELS[s]}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                  />
                )
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="全部产线"
                active={lineFilter === "all"}
                onClick={() => setLineFilter("all")}
              />
              {lines.map((l) => (
                <FilterChip
                  key={l}
                  label={l}
                  active={lineFilter === l}
                  onClick={() => setLineFilter(l)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 bg-slate-800/40" />
      ) : filtered.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
            <ClipboardList className="h-6 w-6 opacity-30" />
            <p className="text-xs">没有符合条件的工单</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-left">
                  <Th onClick={() => toggleSort("order_no")} active={sortKey === "order_no"} dir={sortDir}>MO 号</Th>
                  <Th onClick={() => toggleSort("line_name")} active={sortKey === "line_name"} dir={sortDir}>产线</Th>
                  <Th onClick={() => toggleSort("product_name")} active={sortKey === "product_name"} dir={sortDir}>产品</Th>
                  <th className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">规格</th>
                  <Th onClick={() => toggleSort("quantity")} active={sortKey === "quantity"} dir={sortDir} align="right">计划(罐)</Th>
                  <Th onClick={() => toggleSort("completed_quantity")} active={sortKey === "completed_quantity"} dir={sortDir} align="right">已完成</Th>
                  <th className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">完工率</th>
                  <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>状态</Th>
                  <Th onClick={() => toggleSort("planned_start_date")} active={sortKey === "planned_start_date"} dir={sortDir}>计划起止</Th>
                  <Th onClick={() => toggleSort("priority")} active={sortKey === "priority"} dir={sortDir} align="center">优先级</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => (
                  <WorkOrderRow
                    key={wo.id}
                    wo={wo}
                    onClick={() => router.push(`/work-orders/${wo.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <p className="border-t border-slate-800 p-2 text-center text-xs text-slate-500">
              显示前 100 条 / 共 {filtered.length} 条 · 请使用筛选或搜索
            </p>
          )}
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
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
  align?: "left" | "right" | "center";
}) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider ${
        onClick ? "cursor-pointer select-none hover:text-slate-200" : ""
      } ${active ? "text-orange-400" : "text-slate-500"} ${alignCls}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}

function WorkOrderRow({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  const tone = WO_STATUS_TONE[wo.status] ?? "border-slate-700 text-slate-400";
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-900/80"
    >
      <td className="px-3 py-2 font-mono text-[11px] text-orange-400">{wo.order_no}</td>
      <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{wo.line_name ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="truncate text-xs text-slate-200" title={wo.product_name}>{wo.product_name}</div>
        <div className="font-mono text-[10px] text-slate-500">{wo.product_code}</div>
      </td>
      <td className="px-3 py-2 text-slate-400">{wo.specification && wo.specification !== "—" ? wo.specification : "—"}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200">{wo.quantity.toLocaleString()}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-300">{wo.completed_quantity.toLocaleString()}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono tabular-nums text-[11px] text-slate-300">{rate.toFixed(1)}%</span>
          <div className="h-1 w-12 overflow-hidden bg-slate-800">
            <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, rate)}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className={`font-mono text-[10px] ${tone}`}>
          {WO_STATUS_LABELS[wo.status]}
        </Badge>
      </td>
      <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
        <div>{formatDate(wo.planned_start_date)}</div>
        <div className="text-slate-500">~ {formatDate(wo.planned_end_date)}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`inline-block border px-1.5 font-mono text-[10px] ${
          wo.priority <= 2 ? "border-rose-500/40 text-rose-300" :
          wo.priority >= 4 ? "border-slate-700 text-slate-500" :
          "border-amber-500/40 text-amber-300"
        }`}>P{wo.priority}</span>
      </td>
    </tr>
  );
}

function CreateWorkOrderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_code: "",
    product_name: "",
    specification: "",
    planned_quantity: "",
    line_code: "",
    priority: "3",
    order_type: "制罐生产订单",
    customer_name: "",
    planned_start_date: new Date().toISOString().slice(0, 10),
    planned_end_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/production-lines").then((r) => r.json()),
    ]).then(([p, l]) => {
      if (p.success) setProducts(p.data);
      if (l.success) setLines(l.data);
    });
  }, []);

  function selectProduct(code: string) {
    const p = products.find((x) => x.code === code);
    setForm((f) => ({
      ...f,
      product_code: code,
      product_name: p?.name ?? f.product_name,
      specification: p?.specification && p.specification !== "—" ? p.specification : f.specification,
    }));
  }

  async function submit() {
    if (!form.product_code || !form.planned_quantity || !form.line_code) {
      setError("请选择产品、产线并填写计划数量");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_code: form.product_code,
          product_name: form.product_name,
          specification: form.specification || null,
          planned_quantity: Number(form.planned_quantity),
          line_code: form.line_code,
          priority: Number(form.priority),
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
      <Card className="w-full max-w-2xl border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="font-mono text-sm font-semibold text-slate-100">新增工单</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <CardContent className="space-y-3 p-4">
          <Field label="产品料号" required>
            <select
              value={form.product_code}
              onChange={(e) => selectProduct(e.target.value)}
              className="h-9 w-full rounded-sm border border-slate-800 bg-slate-900 px-2 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
            >
              <option value="">请选择产品</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="产品名称" required>
              <Input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
            <Field label="规格">
              <Input
                value={form.specification}
                onChange={(e) => setForm({ ...form, specification: e.target.value })}
                placeholder="如 400g / 700g"
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="计划数量 (罐)" required>
              <Input
                type="number"
                value={form.planned_quantity}
                onChange={(e) => setForm({ ...form, planned_quantity: e.target.value })}
                placeholder="0"
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
            <Field label="产线" required>
              <select
                value={form.line_code}
                onChange={(e) => setForm({ ...form, line_code: e.target.value })}
                className="h-9 w-full rounded-sm border border-slate-800 bg-slate-900 px-2 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
              >
                <option value="">请选择产线</option>
                {lines.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="优先级 (1最高)">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="h-9 w-full rounded-sm border border-slate-800 bg-slate-900 px-2 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
              >
                <option value="1">P1 · 最高</option>
                <option value="2">P2 · 高</option>
                <option value="3">P3 · 中</option>
                <option value="4">P4 · 低</option>
                <option value="5">P5 · 最低</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="计划开始日期">
              <Input
                type="date"
                value={form.planned_start_date}
                onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
            <Field label="计划结束日期">
              <Input
                type="date"
                value={form.planned_end_date}
                onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="订单类型">
              <select
                value={form.order_type}
                onChange={(e) => setForm({ ...form, order_type: e.target.value })}
                className="h-9 w-full rounded-sm border border-slate-800 bg-slate-900 px-2 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
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
                className="border-slate-800 bg-slate-900 text-slate-200"
              />
            </Field>
          </div>

          <Field label="备注">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-sm border border-slate-800 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-orange-500"
            />
          </Field>

          {error && (
            <div className="border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={submitting}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {submitting ? "创建中..." : "创建工单"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </div>
      {children}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "emerald";
}) {
  const color = {
    slate: "text-slate-200",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  }[tone];
  return (
    <div className="border border-slate-800 bg-slate-900/60 p-3">
      <div className={`font-mono text-2xl tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2 py-1 font-mono text-[11px] transition ${
        active
          ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
          : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
