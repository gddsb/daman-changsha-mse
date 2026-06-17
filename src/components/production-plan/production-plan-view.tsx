"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { addDays, getProductionDate } from "@/lib/date-utils";
import { PLAN_STATUS } from "@/lib/constants";
import type { ProductionLine, ProductionPlan } from "@/types/mes";

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ProductionPlanView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [startDate, setStartDate] = useState<string>(getProductionDate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [filterLine, setFilterLine] = useState<string>("all");
  const [dragOver, setDragOver] = useState<{ date: string; line: string } | null>(null);
  const [editingQty, setEditingQty] = useState<{ id: string; value: string } | null>(null);
  const [unscheduledOrders, setUnscheduledOrders] = useState<
    Array<{
      id: string;
      order_no: string;
      product_name: string;
      product_code: string;
      planned_quantity: number;
      status: string;
      line_code: string | null;
      line_name: string | null;
      priority: number;
    }>
  >([]);

  const endDate = getProductionDate(addDays(new Date(startDate), 6));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, lineRes, woRes] = await Promise.all([
        fetch(`/api/production-plans?from=${startDate}&to=${endDate}`),
        fetch("/api/production-lines"),
        fetch("/api/work-orders?statuses=released,paused&limit=200"),
      ]);
      const planJson = await planRes.json();
      const lineJson = await lineRes.json();
      const woJson = await woRes.json();
      const allPlans: ProductionPlan[] = planJson.success ? planJson.data : [];
      setPlans(allPlans);
      if (lineJson.success) setLines(lineJson.data);
      if (woJson.success) {
        type Wo = {
          id: string;
          order_no: string;
          product_name: string;
          product_code: string;
          quantity: number;
          status: string;
          line_code: string | null;
          line_name: string | null;
          priority: number;
        };
        const allWos: Wo[] = (woJson.data ?? []) as Wo[];
        const scheduledWoIds = new Set(allPlans.map((p) => p.work_order_id));
        setUnscheduledOrders(
          allWos
            .filter((w) => !scheduledWoIds.has(w.id))
            .map((w) => ({
              id: w.id,
              order_no: w.order_no,
              product_name: w.product_name,
              product_code: w.product_code,
              planned_quantity: w.quantity,
              status: w.status,
              line_code: w.line_code,
              line_name: w.line_name,
              priority: w.priority,
            }))
        );
      }
    } catch (e) {
      console.error("加载计划失败", e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(startDate), i);
        return {
          date: getProductionDate(d),
          label: DAY_LABELS[d.getDay()],
          monthDay: `${d.getMonth() + 1}-${d.getDate()}`,
          weekday: d.getDay(),
        };
      }),
    [startDate]
  );

  const visiblePlans = useMemo(
    () => (filterLine === "all" ? plans : plans.filter((p) => p.line_code === filterLine)),
    [plans, filterLine]
  );

  const totalPlanned = visiblePlans.reduce((s, p) => s + p.planned_quantity, 0);
  const orderCount = visiblePlans.length;

  // 每天（按当前产线筛选）的小计：单数 + 数量
  const daySummary = useMemo(() => {
    const map: Record<string, { orderCount: number; qty: number; lineQty: Record<string, number>; lineCount: Record<string, number> }> = {};
    for (const d of days) {
      map[d.date] = { orderCount: 0, qty: 0, lineQty: {}, lineCount: {} };
    }
    for (const p of visiblePlans) {
      const cell = map[p.plan_date];
      if (!cell) continue;
      cell.orderCount += 1;
      cell.qty += p.planned_quantity;
      cell.lineQty[p.line_code] = (cell.lineQty[p.line_code] ?? 0) + p.planned_quantity;
      cell.lineCount[p.line_code] = (cell.lineCount[p.line_code] ?? 0) + 1;
    }
    return map;
  }, [visiblePlans, days]);

  function plansAtCell(date: string, lineCode: string): ProductionPlan[] {
    return visiblePlans
      .filter((p) => p.plan_date === date && p.line_code === lineCode)
      .sort((a, b) => a.work_order_no.localeCompare(b.work_order_no));
  }

  async function movePlan(plan: ProductionPlan, newDate: string, newLine: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, plan_date: newDate, line_code: newLine }),
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: `HTTP ${res.status}` };
      }
      if (!json.success) {
        alert(json.error || "调整失败");
        return;
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  async function changeQuantity(plan: ProductionPlan, newQty: number) {
    if (!Number.isFinite(newQty) || newQty <= 0) {
      alert("数量必须为正整数");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, planned_quantity: Math.floor(newQty) }),
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: `HTTP ${res.status}` };
      }
      if (!json.success) {
        alert(json.error || "修改失败");
        return;
      }
      setEditingQty(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  function onDragStart(e: React.DragEvent, plan: ProductionPlan) {
    e.dataTransfer.setData("text/plain", plan.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragStartUnscheduled(
    e: React.DragEvent,
    wo: { id: string; planned_quantity: number; line_code: string | null }
  ) {
    e.dataTransfer.setData("text/plain", "");
    e.dataTransfer.setData("application/x-unscheduled", wo.id);
    e.dataTransfer.setData("application/x-qty", String(wo.planned_quantity));
    e.dataTransfer.setData("application/x-line", wo.line_code ?? "");
    e.dataTransfer.effectAllowed = "copy";
  }

  function onDragOver(e: React.DragEvent, date: string, line: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver({ date, line });
  }

  function onDragLeave() {
    setDragOver(null);
  }

  async function onDrop(e: React.DragEvent, date: string, line: string) {
    e.preventDefault();
    setDragOver(null);
    // 优先级 1: 拖入"待排产"工单 → 新增排产
    const unschedId = e.dataTransfer.getData("application/x-unscheduled");
    if (unschedId) {
      // 产线必须匹配：工单的默认产线决定了可派到的日格
      const unschedWo = unscheduledOrders.find((w) => w.id === unschedId);
      if (unschedWo && unschedWo.line_code && unschedWo.line_code !== line) {
        const targetLine = lines.find((l) => l.code === line)?.name ?? line;
        const woLine = lines.find((l) => l.code === unschedWo.line_code)?.name ?? unschedWo.line_code;
        alert(`工单 ${unschedWo.order_no} 绑定产线为「${woLine}」，无法排到「${targetLine}」`);
        return;
      }
      await scheduleFromUnscheduled(unschedId, date, line);
      return;
    }
    // 优先级 2: 拖已有排产卡 → 调整
    const planId = e.dataTransfer.getData("text/plain");
    if (!planId) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.plan_date === date && plan.line_code === line) return;
    // 已排产卡的产线也要匹配（不匹配时拒绝）
    if (plan.line_code && plan.line_code !== line) {
      const targetLine = lines.find((l) => l.code === line)?.name ?? line;
      const planLine = lines.find((l) => l.code === plan.line_code)?.name ?? plan.line_code;
      alert(`工单 ${plan.work_order_no} 绑定产线为「${planLine}」，无法换到「${targetLine}」`);
      return;
    }
    await movePlan(plan, date, line);
  }

  async function scheduleFromUnscheduled(woId: string, date: string, line: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_order_id: woId, plan_date: date, line_code: line }),
      });
      const text = await res.text();
      let json: { success?: boolean; error?: string } = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: `HTTP ${res.status}` };
      }
      if (!json.success) {
        alert(json.error || "排产失败");
        return;
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  function shiftWeek(delta: number) {
    const d = addDays(new Date(startDate), delta * 7);
    setStartDate(getProductionDate(d));
  }

  const today = getProductionDate();

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h1 className="font-mono text-base font-semibold text-slate-100">七天滚动生产计划</h1>
          <span className="font-mono text-xs text-slate-500">
            {startDate} ~ {endDate} · 共 {orderCount} 单 · 计划 {formatNumber(totalPlanned)} 罐
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            · 拖拽改日/换线 · 单击/双击查看工单详情
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h-8 rounded-sm border border-slate-800 bg-slate-950 px-2 font-mono text-xs text-slate-300 outline-none focus:border-slate-600"
          >
            <option value="all">全部产线</option>
            {lines.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStartDate(getProductionDate(new Date()))}>
            今天
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 主表格 */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1280px]">
          {/* 表头：日期 */}
          <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900">
            <div className="grid grid-cols-[60px_140px_repeat(7,minmax(0,1fr))]">
              <div className="border-r border-slate-800 px-3 py-2 text-center font-mono text-xs text-slate-500">
                产线
              </div>
              <div className="border-r border-slate-800 px-3 py-2 font-mono text-xs text-slate-500">
                合计
              </div>
              {days.map((d) => {
                const s = daySummary[d.date] ?? { orderCount: 0, qty: 0 };
                return (
                  <div
                    key={d.date}
                    className={`border-r border-slate-800 px-3 py-2 text-center ${
                      d.date === today ? "bg-orange-500/10" : ""
                    }`}
                  >
                    <div
                      className={`font-mono text-sm font-semibold ${
                        d.date === today ? "text-orange-300" : "text-slate-200"
                      }`}
                    >
                      {d.monthDay}
                    </div>
                    <div
                      className={`font-mono text-[10px] ${
                        d.date === today ? "text-orange-400/80" : "text-slate-500"
                      }`}
                    >
                      {d.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 第二行：每天计划合计（订单数 + 数量） */}
            <div className="grid grid-cols-[60px_140px_repeat(7,minmax(0,1fr))] border-t border-slate-800/80">
              <div className="border-r border-slate-800 px-3 py-1.5 text-center font-mono text-[10px] text-slate-600">
                日合计
              </div>
              <div className="border-r border-slate-800 px-3 py-1.5 text-right font-mono text-[11px] text-slate-400">
                <span className="tabular-nums">{orderCount}</span>
                <span className="text-slate-600"> 单 · </span>
                <span className="tabular-nums text-slate-200">{formatNumber(totalPlanned)}</span>
                <span className="text-slate-600"> 罐</span>
              </div>
              {days.map((d) => {
                const s = daySummary[d.date] ?? { orderCount: 0, qty: 0 };
                const isWeekend = d.weekday === 0 || d.weekday === 6;
                return (
                  <div
                    key={`sum-${d.date}`}
                    className={`border-r border-slate-800 px-2 py-1.5 text-center font-mono text-[11px] ${
                      d.date === today ? "bg-orange-500/10" : ""
                    } ${isWeekend ? "text-slate-600" : "text-slate-300"}`}
                    title={
                      s.orderCount > 0
                        ? `${d.date} · ${s.orderCount} 个订单 · 共 ${formatNumber(s.qty)} 罐`
                        : `${d.date} · 暂无计划`
                    }
                  >
                    {s.orderCount > 0 ? (
                      <>
                        <span
                          className={`tabular-nums ${
                            d.date === today ? "text-orange-300" : "text-slate-100"
                          }`}
                        >
                          {formatNumber(s.qty)}
                        </span>
                        <span className="text-slate-600"> 罐</span>
                        <span className="mx-1 text-slate-700">·</span>
                        <span
                          className={`tabular-nums ${
                            d.date === today ? "text-orange-400/80" : "text-slate-500"
                          }`}
                        >
                          {s.orderCount} 单
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : lines.length === 0 ? (
            <div className="p-6 text-center font-mono text-sm text-slate-500">暂无产线</div>
          ) : (
            lines
              .filter((l) => filterLine === "all" || l.code === filterLine)
              .map((line) => {
                const linePlans = visiblePlans.filter((p) => p.line_code === line.code);
                const lineTotal = linePlans.reduce((s, p) => s + p.planned_quantity, 0);
                return (
                  <div
                    key={line.code}
                    className="grid grid-cols-[60px_140px_repeat(7,minmax(0,1fr))] border-b border-slate-800"
                  >
                    <div className="flex items-center justify-center border-r border-slate-800 bg-slate-900/60 px-2 py-3 font-mono text-xs font-semibold text-slate-100">
                      {line.name}
                    </div>
                    <div className="flex flex-col items-center justify-center border-r border-slate-800 bg-slate-900/60 px-2 py-3">
                      <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {formatNumber(lineTotal)}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{linePlans.length} 单</div>
                    </div>
                    {days.map((d) => {
                      const cellPlans = plansAtCell(d.date, line.code);
                      const isDragOver =
                        dragOver && dragOver.date === d.date && dragOver.line === line.code;
                      return (
                        <div
                          key={`${line.code}-${d.date}`}
                          onDragOver={(e) => onDragOver(e, d.date, line.code)}
                          onDragLeave={onDragLeave}
                          onDrop={(e) => onDrop(e, d.date, line.code)}
                          className={`min-h-[110px] border-r border-slate-800 p-1.5 transition ${
                            d.date === today ? "bg-orange-500/[0.03]" : ""
                          } ${isDragOver ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/40" : ""}`}
                        >
                          {cellPlans.map((p) => (
                            <PlanCard
                              key={p.id}
                              plan={p}
                              onDragStart={(e) => onDragStart(e, p)}
                              onDoubleClick={() =>
                                router.push(`/work-orders/${p.work_order_id}`)
                              }
                              onClick={() => router.push(`/work-orders/${p.work_order_id}`)}
                            />
                          ))}
                          {cellPlans.length === 0 && d.weekday !== 0 && d.weekday !== 6 && (
                            <div className="flex h-full items-center justify-center font-mono text-xs text-slate-700">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* 待排产工单：未排入本周排程的已下发 / 已暂停工单，可拖到上方日格 */}
      <UnscheduledOrdersPanel
        orders={unscheduledOrders}
        onDragStart={(e, wo) => onDragStartUnscheduled(e, wo)}
      />

      {/* 双击编辑数量弹窗 */}
      {editingQty && (
        <QtyEditDialog
          plan={plans.find((p) => p.id === editingQty.id)!}
          initialValue={editingQty.value}
          submitting={submitting}
          onCancel={() => setEditingQty(null)}
          onConfirm={(qty) => {
            const p = plans.find((x) => x.id === editingQty.id);
            if (p) changeQuantity(p, qty);
          }}
        />
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onDragStart,
  onDoubleClick,
  onClick,
}: {
  plan: ProductionPlan;
  onDragStart: (e: React.DragEvent) => void;
  onDoubleClick: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      className={`mb-1 w-full cursor-grab rounded-sm border px-1.5 py-1 text-left transition-colors hover:border-slate-600 active:cursor-grabbing ${
        PLAN_STATUS[plan.status] ?? "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-mono text-[10px] text-slate-300">{plan.work_order_no}</span>

      </div>
      <div className="mt-0.5 truncate font-mono text-xs font-semibold text-slate-100 tabular-nums">
        {formatNumber(plan.planned_quantity)} 罐
      </div>
      <div className="truncate text-[10px] text-slate-500">{plan.product_name}</div>
    </div>
  );
}

function QtyEditDialog({
  plan,
  initialValue,
  submitting,
  onCancel,
  onConfirm,
}: {
  plan: ProductionPlan;
  initialValue: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="w-[420px] border-slate-800 bg-slate-950">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 py-3">
          <CardTitle className="flex items-center gap-2 font-mono text-sm">
            <ArrowRightLeft className="h-4 w-4 text-orange-400" />
            修改排产数量
          </CardTitle>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-200">
            ×
          </button>
        </CardHeader>
        <CardContent className="space-y-3 py-4">
          <div className="rounded-sm border border-slate-800 bg-slate-900 p-2.5 text-xs">
            <div className="font-mono text-slate-400">工单：{plan.work_order_no}</div>
            <div className="text-slate-300">{plan.product_name}</div>
            <div className="mt-1 font-mono text-slate-500">
              原数量：<span className="text-slate-200">{formatNumber(plan.planned_quantity)}</span> 罐
              · {plan.plan_date} · {plan.line_name}
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-xs text-slate-500">新计划数量 (罐)</div>
            <Input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm(Number(val));
                if (e.key === "Escape") onCancel();
              }}
              className="border-slate-800 bg-slate-900 text-slate-100"
            />
          </div>
          <div className="flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>只能调整未开工或已开工未完工的工单。已完工/已关闭工单不可调整。</span>
          </div>
        </CardContent>
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <Button variant="ghost" onClick={onCancel} size="sm">取消</Button>
          <Button
            size="sm"
            disabled={submitting}
            onClick={() => onConfirm(Number(val))}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {submitting ? "保存中..." : "确认"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

type UnscheduledOrder = {
  id: string;
  order_no: string;
  product_name: string;
  product_code: string;
  planned_quantity: number;
  status: string;
  line_code: string | null;
  line_name: string | null;
  priority: number;
};

function UnscheduledOrdersPanel({
  orders,
  onDragStart,
}: {
  orders: UnscheduledOrder[];
  onDragStart: (
    e: React.DragEvent,
    wo: { id: string; planned_quantity: number; line_code: string | null }
  ) => void;
}) {
  return (
    <div className="border-b border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            待排产工单
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            · {orders.length} 单 · 拖入上方日格完成排程
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-600">
          包含：已下发(released) · 已暂停(paused)
        </span>
      </div>
      <div className="flex flex-wrap gap-2 px-6 pb-3">
        {orders.length === 0 ? (
          <div className="py-2 font-mono text-[11px] text-slate-600">
            暂无待排产工单
          </div>
        ) : (
          orders.map((wo) => (
            <div
              key={wo.id}
              draggable
              onDragStart={(e) =>
                onDragStart(e, {
                  id: wo.id,
                  planned_quantity: wo.planned_quantity,
                  line_code: wo.line_code,
                })
              }
              className="cursor-grab border border-amber-500/30 bg-amber-900/10 px-2 py-1.5 transition-colors hover:border-amber-500/60 hover:bg-amber-900/20 active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-amber-300">
                  {wo.order_no}
                </span>
                <span
                  className={`border px-1 font-mono text-[9px] ${
                    wo.status === "暂停"
                      ? "border-orange-500/40 text-orange-300"
                      : "border-sky-500/40 text-sky-300"
                  }`}
                >
                  {wo.status === "暂停" ? "已暂停" : "已下发"}
                </span>

              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-300">
                <span className="truncate max-w-[160px]">{wo.product_name}</span>
                <span className="font-mono text-slate-500">
                  {formatNumber(wo.planned_quantity)} 罐
                </span>
                <span className="font-mono text-slate-500">
                  · {wo.line_name ?? wo.line_code ?? "—"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
