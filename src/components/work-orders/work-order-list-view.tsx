/**
 * 工单列表（制罐业务版）
 * - 显示 MO 号、产线、产品、计划量、已完成、13 道工序进度
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
import { Search, RefreshCcw, ClipboardList, Factory } from "lucide-react";
import { formatDate } from "@/lib/format";
import { WO_STATUS_TONE, WO_STATUS_LABELS } from "@/lib/constants";
import type { WorkOrder } from "@/types/mes";

export function WorkOrderListView() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    return orders.filter((o) => {
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
  }, [orders, search, statusFilter, lineFilter]);

  const summary = useMemo(() => {
    if (!orders) return null;
    return {
      total: orders.length,
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      completed: orders.filter((o) => o.status === "completed").length,
      planned: orders.filter((o) => o.status === "planned" || o.status === "released").length,
    };
  }, [orders]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">工单管理</h1>
          <p className="mt-0.5 text-xs text-slate-500">U9 同步制罐生产订单 · 13 道连续工序</p>
        </div>
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, 60).map((wo) => (
            <WorkOrderCard
              key={wo.id}
              wo={wo}
              onClick={() => router.push(`/work-orders/${wo.id}`)}
            />
          ))}
        </div>
      )}
      {filtered.length > 60 && (
        <p className="text-center text-xs text-slate-500">
          显示前 60 条 / 共 {filtered.length} 条 · 请使用筛选或搜索
        </p>
      )}
    </div>
  );
}

function WorkOrderCard({ wo, onClick }: { wo: WorkOrder; onClick: () => void }) {
  const rate = wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
  const tone = WO_STATUS_TONE[wo.status] ?? "border-slate-700 text-slate-400";
  return (
    <button
      onClick={onClick}
      className="group space-y-3 border border-slate-800 bg-slate-900/40 p-3 text-left transition hover:border-orange-500/40 hover:bg-slate-900/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-orange-400">{wo.order_no}</span>
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${tone}`}
            >
              {WO_STATUS_LABELS[wo.status]}
            </Badge>
            {wo.order_type && (
              <Badge
                variant="outline"
                className="border-slate-700 font-mono text-[10px] text-slate-500"
              >
                {wo.order_type === "制罐生产订单" ? "制罐" : "返工"}
              </Badge>
            )}
          </div>
          <div className="mt-1.5 truncate text-sm text-slate-200">{wo.product_name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-500">{wo.product_code}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg leading-none text-slate-100">
            {wo.completed_quantity.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-500">
            / {wo.quantity.toLocaleString()} 罐
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Factory className="h-3 w-3" />
          <span className="font-mono">{wo.line_name ?? "未分配"}</span>
        </div>
        <span className="text-slate-500">不良 {wo.scrap_quantity}</span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>完工率</span>
          <span className="font-mono text-slate-300">{rate.toFixed(1)}%</span>
        </div>
        <Progress
          value={rate}
          className="h-1 bg-slate-800 [&>div]:bg-orange-500"
        />
      </div>

      <div className="border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
        计划 {formatDate(wo.planned_start_date)} ~ {formatDate(wo.planned_end_date)}
      </div>
    </button>
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
