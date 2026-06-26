"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  AlertCircle,
  GripVertical,
  Trash2,
  Inbox,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { addDays, getProductionDate } from "@/lib/date-utils";
import { PLAN_STATUS, WO_STATUS_LABELS } from "@/lib/constants";
import type { ProductionLine, ProductionPlan } from "@/types/mes";

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// 待排产工单类型
type UnscheduledOrder = {
  id: string;
  order_no: string;
  product_name: string;
  product_code: string;
  planned_quantity: number;
  status: string;
  line_code: string | null;
  line_name: string | null;
};

export function ProductionPlanView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [startDate, setStartDate] = useState<string>(getProductionDate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [filterLine, setFilterLine] = useState<string>("all");
  const [dragOver, setDragOver] = useState<{ date: string; line: string } | null>(null);
  const [unscheduledOrders, setUnscheduledOrders] = useState<UnscheduledOrder[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const endDate = getProductionDate(addDays(new Date(startDate), 6));
  const today = getProductionDate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, lineRes, woRes] = await Promise.all([
        fetch(`/api/production-plans?from=${startDate}&to=${endDate}`),
        fetch("/api/production-lines"),
        fetch(
          "/api/work-orders?statuses=" +
            encodeURIComponent("下发") +
            "&limit=200"
        ),
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
        };
        const allWos: Wo[] = (woJson.data ?? []) as Wo[];
        const scheduledWoIds = new Set(allPlans.map((p) => p.work_order_id));
        const unsched: UnscheduledOrder[] = allWos
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
          }));
        setUnscheduledOrders(unsched);
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
    () =>
      filterLine === "all"
        ? plans
        : plans.filter((p) => p.line_code === filterLine),
    [plans, filterLine]
  );

  const visibleLines = useMemo(
    () => (filterLine === "all" ? lines : lines.filter((l) => l.code === filterLine)),
    [lines, filterLine]
  );

  const totalPlanned = visiblePlans.reduce((s, p) => s + p.planned_quantity, 0);
  const orderCount = visiblePlans.length;

  // 每天合计
  const daySummary = useMemo(() => {
    const map: Record<
      string,
      { orderCount: number; qty: number; lineQty: Record<string, number> }
    > = {};
    for (const d of days) {
      map[d.date] = { orderCount: 0, qty: 0, lineQty: {} };
    }
    for (const p of visiblePlans) {
      const cell = map[p.plan_date];
      if (!cell) continue;
      cell.orderCount += 1;
      cell.qty += p.planned_quantity;
      cell.lineQty[p.line_code] = (cell.lineQty[p.line_code] ?? 0) + p.planned_quantity;
    }
    return map;
  }, [visiblePlans, days]);

  // 按产线分组的待排产
  const unschedByLine = useMemo(() => {
    const m: Record<string, UnscheduledOrder[]> = {};
    for (const l of lines) m[l.code] = [];
    m["__none__"] = [];
    for (const wo of unscheduledOrders) {
      const key = wo.line_code && m[wo.line_code] ? wo.line_code : "__none__";
      m[key].push(wo);
    }
    return m;
  }, [unscheduledOrders, lines]);

  function plansAtCell(date: string, lineCode: string): ProductionPlan[] {
    return visiblePlans
      .filter((p) => p.plan_date === date && p.line_code === lineCode)
      .sort((a, b) => a.work_order_no.localeCompare(b.work_order_no));
  }

  function lineNameOf(code: string | null | undefined): string {
    if (!code) return "未指定";
    return lines.find((l) => l.code === code)?.name ?? code;
  }

  // ========== API 交互 ==========

  async function movePlan(
    plan: ProductionPlan,
    newDate: string,
    newLine: string
  ) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          plan_date: newDate,
          line_code: newLine,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "调整失败");
        return;
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  async function removePlan(plan: ProductionPlan) {
    if (!confirm(`确认将工单 ${plan.work_order_no} 移出 7 天排产？`)) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/production-plans?id=${encodeURIComponent(plan.id)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "移除失败");
        return;
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  async function scheduleFromUnscheduled(woId: string, date: string, line: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          work_order_id: woId,
          plan_date: date,
          line_code: line,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "排产失败");
        return;
      }
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  // ========== 拖拽 ==========

  function onPlanDragStart(e: React.DragEvent, plan: ProductionPlan) {
    e.dataTransfer.setData("text/plain", plan.id);
    e.dataTransfer.setData("application/x-plan", plan.id);
    e.dataTransfer.setData("application/x-line", plan.line_code ?? "");
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(plan.id);
  }

  function onUnscheduledDragStart(
    e: React.DragEvent,
    wo: UnscheduledOrder
  ) {
    e.dataTransfer.setData("application/x-unscheduled", wo.id);
    e.dataTransfer.setData("application/x-qty", String(wo.planned_quantity));
    e.dataTransfer.setData("application/x-line", wo.line_code ?? "");
    e.dataTransfer.effectAllowed = "copy";
    setDraggingId(wo.id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function onDragOver(e: React.DragEvent, date: string, line: string) {
    e.preventDefault();
    // 验证产线匹配（根据当前拖的是排产卡还是待排产工单）
    const sourceLine = e.dataTransfer.getData("application/x-line");
    if (sourceLine && sourceLine !== line) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(
      "application/x-unscheduled"
    )
      ? "copy"
      : "move";
    setDragOver({ date, line });
  }

  function onDragLeaveCell() {
    setDragOver(null);
  }

  async function onDrop(e: React.DragEvent, date: string, line: string) {
    e.preventDefault();
    setDragOver(null);
    setDraggingId(null);

    // 1) 待排产工单 → 新建排产
    const unschedId = e.dataTransfer.getData("application/x-unscheduled");
    if (unschedId) {
      const wo = unscheduledOrders.find((w) => w.id === unschedId);
      if (!wo) return;
      if (wo.line_code && wo.line_code !== line) {
        alert(
          `工单 ${wo.order_no} 绑定产线为「${lineNameOf(wo.line_code)}」，无法排到「${lineNameOf(line)}」`
        );
        return;
      }
      await scheduleFromUnscheduled(unschedId, date, line);
      return;
    }

    // 2) 已排产卡 → 改日/换线
    const planId =
      e.dataTransfer.getData("application/x-plan") ||
      e.dataTransfer.getData("text/plain");
    if (!planId) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.plan_date === date && plan.line_code === line) return;
    if (plan.line_code && plan.line_code !== line) {
      alert(
        `工单 ${plan.work_order_no} 绑定产线为「${lineNameOf(plan.line_code)}」，无法换到「${lineNameOf(line)}」`
      );
      return;
    }
    await movePlan(plan, date, line);
  }

  function shiftWeek(delta: number) {
    const d = addDays(new Date(startDate), delta * 7);
    setStartDate(getProductionDate(d));
  }

  // 阻止点击卡片/格子后冒泡跳详情
  function gotoDetail(woId: string) {
    router.push(`/work-orders/${woId}`);
  }

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-slate-800 bg-slate-900/60 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-orange-400" />
          <h1 className="font-mono text-base font-semibold text-slate-100">
            七天滚动生产计划
          </h1>
          <span className="rounded-sm border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {startDate} ~ {endDate}
          </span>
          <span className="font-mono text-xs text-slate-500">
            共 {orderCount} 单 · 计划 {formatNumber(totalPlanned)} 罐
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftWeek(-1)}
            title="上一周"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStartDate(getProductionDate(new Date()))}
            title="回到本周"
          >
            今天
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftWeek(1)}
            title="下一周"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            title="刷新"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 主表格区 */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[1280px]">
          {/* 表头：日期 */}
          <div className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900">
            <div className="grid grid-cols-[80px_120px_repeat(7,minmax(0,1fr))]">
              <div className="border-r border-slate-800 px-3 py-2 text-center font-mono text-xs text-slate-500">
                产线
              </div>
              <div className="border-r border-slate-800 px-3 py-2 font-mono text-xs text-slate-500">
                合计
              </div>
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`border-r border-slate-800 px-3 py-2 text-center ${
                    d.date === today ? "bg-orange-500/10" : ""
                  } ${d.weekday === 0 || d.weekday === 6 ? "opacity-60" : ""}`}
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
                      d.date === today
                        ? "text-orange-400/80"
                        : "text-slate-500"
                    }`}
                  >
                    {d.label}
                  </div>
                </div>
              ))}
            </div>
            {/* 日合计行 */}
            <div className="grid grid-cols-[80px_120px_repeat(7,minmax(0,1fr))] border-t border-slate-800/80">
              <div className="border-r border-slate-800 px-3 py-1.5 text-center font-mono text-[10px] text-slate-600">
                日合计
              </div>
              <div className="border-r border-slate-800 px-3 py-1.5 text-right font-mono text-[11px] text-slate-400">
                <span className="tabular-nums">{orderCount}</span>
                <span className="text-slate-600"> 单 · </span>
                <span className="tabular-nums text-slate-200">
                  {formatNumber(totalPlanned)}
                </span>
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
                        ? `${d.date} · ${s.orderCount} 单 · ${formatNumber(s.qty)} 罐`
                        : `${d.date} · 暂无`
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
                            d.date === today
                              ? "text-orange-400/80"
                              : "text-slate-500"
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

          {/* 表格体 */}
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : lines.length === 0 ? (
            <div className="p-6 text-center font-mono text-sm text-slate-500">
              暂无产线
            </div>
          ) : (
            visibleLines.map((line) => {
              const linePlans = visiblePlans.filter(
                (p) => p.line_code === line.code
              );
              const lineTotal = linePlans.reduce(
                (s, p) => s + p.planned_quantity,
                0
              );
              return (
                <div
                  key={line.code}
                  className="grid grid-cols-[80px_120px_repeat(7,minmax(0,1fr))] border-b border-slate-800"
                >
                  <div className="flex flex-col items-center justify-center border-r border-slate-800 bg-slate-900/60 px-2 py-3 font-mono text-xs font-semibold text-slate-100">
                    {line.name}
                  </div>
                  <div className="flex flex-col items-center justify-center border-r border-slate-800 bg-slate-900/60 px-2 py-3">
                    <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                      {formatNumber(lineTotal)}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {linePlans.length} 单
                    </div>
                  </div>
                  {days.map((d) => {
                    const cellPlans = plansAtCell(d.date, line.code);
                    const isDragOver =
                      dragOver &&
                      dragOver.date === d.date &&
                      dragOver.line === line.code;
                    const isWeekend = d.weekday === 0 || d.weekday === 6;
                    return (
                      <div
                        key={`${line.code}-${d.date}`}
                        onDragOver={(e) => onDragOver(e, d.date, line.code)}
                        onDragLeave={onDragLeaveCell}
                        onDrop={(e) => onDrop(e, d.date, line.code)}
                        className={`min-h-[112px] border-r border-slate-800 p-1.5 transition-colors ${
                          d.date === today ? "bg-orange-500/[0.03]" : ""
                        } ${
                          isWeekend ? "bg-slate-900/40" : ""
                        } ${
                          isDragOver
                            ? "bg-orange-500/15 ring-1 ring-inset ring-orange-500/50"
                            : ""
                        }`}
                      >
                        {cellPlans.map((p) => (
                          <PlanCard
                            key={p.id}
                            plan={p}
                            isDragging={draggingId === p.id}
                            onDragStart={(e) => onPlanDragStart(e, p)}
                            onDragEnd={onDragEnd}
                            onClick={() => gotoDetail(p.work_order_id)}
                            onDoubleClick={() => gotoDetail(p.work_order_id)}
                            onRemove={() => removePlan(p)}
                            disabled={submitting}
                          />
                        ))}
                        {cellPlans.length === 0 && !isWeekend && (
                          <div className="flex h-full items-center justify-center font-mono text-[10px] text-slate-700">
                            —
                          </div>
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

      {/* 待排产工单面板 */}
      <UnscheduledOrdersPanel
        orders={unscheduledOrders}
        unschedByLine={unschedByLine}
        lines={visibleLines}
        draggingId={draggingId}
        onDragStart={onUnscheduledDragStart}
        onDragEnd={onDragEnd}
      />
    </div>
  );
}

// ==================== 子组件：排产卡 ====================

function PlanCard({
  plan,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onDoubleClick,
  onRemove,
  disabled,
}: {
  plan: ProductionPlan;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);
  const tone = PLAN_STATUS[plan.status] ?? "border-slate-800 bg-slate-900/60";
  
  // 已开工/暂停/完工/已关闭的工单不允许拖拽和删除
  const blockedStatuses = ['生产中', 'in_progress', '暂停', 'paused', '完工', 'completed', '已关闭', 'closed'];
  const isBlocked = plan.wo_status && blockedStatuses.includes(plan.wo_status);
  const statusLabel = plan.wo_status === '生产中' || plan.wo_status === 'in_progress' ? '已开工' :
                      plan.wo_status === '暂停' || plan.wo_status === 'paused' ? '已暂停' :
                      plan.wo_status === '完工' || plan.wo_status === 'completed' ? '已完工' : '已关闭';

  return (
    <div
      draggable={!isBlocked}
      onDragStart={isBlocked ? undefined : onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`group relative mb-1 w-full cursor-pointer rounded-sm border px-1.5 py-1 text-left transition-all hover:border-slate-500 ${
        isDragging ? "opacity-30" : ""
      } ${disabled || isBlocked ? "pointer-events-none" : ""} ${
        isBlocked ? "opacity-70 border-warning/30 bg-warning/5" : ""
      } ${tone}`}
      title={isBlocked 
        ? `工单 ${statusLabel}，不允许调整计划` 
        : `双击查看工单详情 · ${plan.work_order_no}`}
    >
      {isBlocked && (
        <span className="absolute -top-1 -right-1 rounded bg-warning px-1 py-0.5 text-[9px] text-warning-foreground">
          {statusLabel}
        </span>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-mono text-[10px] text-slate-300">
          {plan.work_order_no}
        </span>
        {!isBlocked && <GripVertical className="h-3 w-3 shrink-0 text-slate-600" />}
      </div>
      <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-100 tabular-nums">
        {formatNumber(plan.planned_quantity)} 罐
      </div>
      <div className="truncate text-[10px] text-slate-500">
        {plan.product_name}
      </div>
      {!isBlocked && hover && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-sm border border-rose-500/60 bg-rose-500/20 text-rose-300 hover:bg-rose-500/40"
          title="移出 7 天排产"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ==================== 子组件：待排产工单 ====================

function UnscheduledOrdersPanel({
  orders,
  unschedByLine,
  lines,
  draggingId,
  onDragStart,
  onDragEnd,
}: {
  orders: UnscheduledOrder[];
  unschedByLine: Record<string, UnscheduledOrder[]>;
  lines: ProductionLine[];
  draggingId: string | null;
  onDragStart: (e: React.DragEvent, wo: UnscheduledOrder) => void;
  onDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (orders.length === 0) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/40 px-6 py-2">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
          <Inbox className="h-3.5 w-3.5" />
          <span>待排产工单：暂无（所有已下发 / 暂停工单已排入本周）</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/60">
      <div
        className="flex cursor-pointer items-center justify-between px-6 py-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-xs font-semibold text-slate-200">
            待排产工单
          </span>
          <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
            {orders.length}
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            · 包含「下发」「暂停」状态 · 拖入上方日格完成排程
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-600">
          {expanded ? "收起 ▲" : "展开 ▼"}
        </span>
      </div>
      {expanded && (
        <div className="border-t border-slate-800/60 px-6 py-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(lines.length, 1)}, minmax(0, 1fr))` }}>
            {lines.length === 0 ? (
              <div className="font-mono text-[11px] text-slate-600">暂无产线</div>
            ) : (
              lines.map((line) => {
                const list = (unschedByLine[line.code] ?? []).filter(
                  (w) => w.line_code === line.code
                );
                return (
                  <div
                    key={line.code}
                    className="min-h-[60px] rounded-sm border border-slate-800 bg-slate-900/40 p-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-slate-400">{line.name}</span>
                      <span className="text-slate-600">{list.length} 单</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {list.length === 0 ? (
                        <div className="py-1 text-center font-mono text-[10px] text-slate-700">
                          无
                        </div>
                      ) : (
                        list.map((wo) => (
                          <UnscheduledCard
                            key={wo.id}
                            wo={wo}
                            isDragging={draggingId === wo.id}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {unschedByLine["__none__"]?.length > 0 && (
              <div className="min-h-[60px] rounded-sm border border-slate-800 bg-slate-900/40 p-2">
                <div className="mb-1.5 flex items-center justify-between font-mono text-[10px]">
                  <span className="text-slate-400">未指定产线</span>
                  <span className="text-slate-600">
                    {unschedByLine["__none__"].length} 单
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {unschedByLine["__none__"].map((wo) => (
                    <UnscheduledCard
                      key={wo.id}
                      wo={wo}
                      isDragging={draggingId === wo.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UnscheduledCard({
  wo,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  wo: UnscheduledOrder;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, wo: UnscheduledOrder) => void;
  onDragEnd: () => void;
}) {
  const isPaused = wo.status === "暂停";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, wo)}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab items-center justify-between gap-2 rounded-sm border px-1.5 py-1 text-left transition-colors active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      } ${
        isPaused
          ? "border-orange-500/30 bg-orange-900/10 hover:border-orange-500/60"
          : "border-sky-500/30 bg-sky-900/10 hover:border-sky-500/60"
      }`}
      title={`拖到上方日格完成排程 · ${wo.order_no}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[10px] text-slate-200">
            {wo.order_no}
          </span>
          <span
            className={`shrink-0 border px-1 font-mono text-[9px] ${
              isPaused
                ? "border-orange-500/40 text-orange-300"
                : "border-sky-500/40 text-sky-300"
            }`}
          >
            {WO_STATUS_LABELS[wo.status] ?? wo.status}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
          <span className="truncate text-slate-400">{wo.product_name}</span>
          <span className="shrink-0 font-mono text-slate-500">
            · {formatNumber(wo.planned_quantity)} 罐
          </span>
        </div>
      </div>
      <GripVertical className="h-3 w-3 shrink-0 text-slate-600" />
    </div>
  );
}
