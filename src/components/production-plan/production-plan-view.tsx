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
import { PRIORITY_TONE, PLAN_STATUS } from "@/lib/constants";
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

  const endDate = getProductionDate(addDays(new Date(startDate), 6));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, lineRes] = await Promise.all([
        fetch(`/api/production-plans?from=${startDate}&to=${endDate}`),
        fetch("/api/production-lines"),
      ]);
      const planJson = await planRes.json();
      const lineJson = await lineRes.json();
      if (planJson.success) setPlans(planJson.data);
      if (lineJson.success) setLines(lineJson.data);
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

  function plansAtCell(date: string, lineCode: string): ProductionPlan[] {
    return visiblePlans
      .filter((p) => p.plan_date === date && p.line_code === lineCode)
      .sort((a, b) => a.priority - b.priority);
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
    const planId = e.dataTransfer.getData("text/plain");
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    if (plan.plan_date === date && plan.line_code === line) return;
    await movePlan(plan, date, line);
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
            · 拖拽改日/换线 · 双击改数量
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
          <div className="sticky top-0 z-10 grid grid-cols-[60px_140px_repeat(7,minmax(0,1fr))] border-b border-slate-700 bg-slate-900">
            <div className="border-r border-slate-800 px-3 py-2 text-center font-mono text-xs text-slate-500">产线</div>
            <div className="border-r border-slate-800 px-3 py-2 font-mono text-xs text-slate-500">合计</div>
            {days.map((d) => (
              <div
                key={d.date}
                className={`border-r border-slate-800 px-3 py-2 text-center ${
                  d.date === today ? "bg-orange-500/10 text-orange-300" : "text-slate-300"
                }`}
              >
                <div className="font-mono text-sm font-semibold">{d.monthDay}</div>
                <div className="font-mono text-xs text-slate-500">{d.label}</div>
              </div>
            ))}
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
                                setEditingQty({ id: p.id, value: String(p.planned_quantity) })
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
        <span
          className={`shrink-0 rounded-sm border px-1 font-mono text-[10px] ${
            PRIORITY_TONE[plan.priority] ?? "border-slate-700 text-slate-500"
          }`}
        >
          P{plan.priority}
        </span>
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
