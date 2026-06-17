"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, RefreshCw, Calendar, ArrowRightLeft, AlertCircle, Package } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { addDays, getProductionDate } from "@/lib/date-utils";
import { PRIORITY_TONE, PLAN_STATUS_LABELS, PLAN_STATUS } from "@/lib/constants";
import type { ProductionLine, ProductionPlan } from "@/types/mes";

const DAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ProductionPlanView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [startDate, setStartDate] = useState<string>(getProductionDate(new Date()));
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterLine, setFilterLine] = useState<string>("all");

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

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(startDate), i);
    return {
      date: getProductionDate(d),
      label: DAY_LABELS[d.getDay()],
      monthDay: `${d.getMonth() + 1}-${d.getDate()}`,
      weekday: d.getDay(),
    };
  });

  const visiblePlans = filterLine === "all" ? plans : plans.filter((p) => p.line_code === filterLine);

  const totalPlanned = visiblePlans.reduce((s, p) => s + p.planned_quantity, 0);
  const orderCount = visiblePlans.length;

  function plansAtCell(date: string, lineCode: string) {
    return visiblePlans
      .filter((p) => p.plan_date === date && p.line_code === lineCode)
      .sort((a, b) => a.priority - b.priority);
  }

  async function reschedulePlan(plan: ProductionPlan, newDate: string, newLine: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, plan_date: newDate, line_code: newLine }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "调整失败");
        return;
      }
      setEditingPlan(null);
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
      <div className="flex items-center justify-between border-b border-line bg-bg-1 px-6 py-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-fg-2" />
          <h1 className="font-mono text-base font-semibold text-fg-0">七天滚动生产计划</h1>
          <span className="font-mono text-xs text-fg-2">
            {startDate} ~ {endDate} · 共 {orderCount} 单 · 计划 {formatNumber(totalPlanned)} 罐
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h-8 rounded-sm border border-line bg-bg-0 px-2 font-mono text-xs text-fg-1 outline-none focus:border-line-strong"
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
          <div className="grid sticky top-0 z-10 grid-cols-[60px_140px_repeat(7,minmax(0,1fr))] border-b border-line-strong bg-bg-1">
            <div className="border-r border-line px-3 py-2 text-center font-mono text-xs text-fg-2">产线</div>
            <div className="border-r border-line px-3 py-2 font-mono text-xs text-fg-2">合计</div>
            {days.map((d) => (
              <div
                key={d.date}
                className={`border-r border-line px-3 py-2 text-center ${
                  d.date === today ? "bg-accent/10 text-accent" : "text-fg-1"
                }`}
              >
                <div className="font-mono text-sm font-semibold">{d.monthDay}</div>
                <div className="font-mono text-xs text-fg-2">{d.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : lines.length === 0 ? (
            <div className="p-6 text-center font-mono text-sm text-fg-2">暂无产线</div>
          ) : (
            lines
              .filter((l) => filterLine === "all" || l.code === filterLine)
              .map((line) => {
                const linePlans = visiblePlans.filter((p) => p.line_code === line.code);
                const lineTotal = linePlans.reduce((s, p) => s + p.planned_quantity, 0);
                return (
                  <div
                    key={line.code}
                    className="grid grid-cols-[60px_140px_repeat(7,minmax(0,1fr))] border-b border-line"
                  >
                    <div className="flex items-center justify-center border-r border-line bg-bg-1 px-2 py-3 font-mono text-xs font-semibold text-fg-0">
                      {line.name}
                    </div>
                    <div className="flex flex-col items-center justify-center border-r border-line bg-bg-1 px-2 py-3">
                      <div className="font-mono text-sm font-semibold text-fg-0 tabular-nums">
                        {formatNumber(lineTotal)}
                      </div>
                      <div className="font-mono text-xs text-fg-2">{linePlans.length} 单</div>
                    </div>
                    {days.map((d) => {
                      const cellPlans = plansAtCell(d.date, line.code);
                      return (
                        <div
                          key={`${line.code}-${d.date}`}
                          className={`min-h-[100px] border-r border-line p-1.5 ${
                            d.date === today ? "bg-accent/[0.04]" : ""
                          }`}
                        >
                          {cellPlans.map((p) => (
                            <PlanCard
                              key={p.id}
                              plan={p}
                              onClick={() => setEditingPlan(p)}
                            />
                          ))}
                          {cellPlans.length === 0 && d.weekday !== 0 && d.weekday !== 6 && (
                            <div className="flex h-full items-center justify-center font-mono text-xs text-fg-3">
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

      {/* 调整计划弹窗 */}
      {editingPlan && (
        <RescheduleDialog
          plan={editingPlan}
          days={days}
          lines={lines}
          submitting={submitting}
          onCancel={() => setEditingPlan(null)}
          onConfirm={(date, lineCode) => reschedulePlan(editingPlan, date, lineCode)}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, onClick }: { plan: ProductionPlan; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 w-full rounded-sm border px-1.5 py-1 text-left transition-colors hover:border-line-strong ${
        PLAN_STATUS[plan.status] ?? "border-line bg-bg-2/40"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-mono text-[10px] text-fg-1">{plan.work_order_no}</span>
        <span
          className={`shrink-0 rounded-sm border px-1 font-mono text-[10px] ${
            PRIORITY_TONE[plan.priority] ?? "border-line text-fg-2"
          }`}
        >
          P{plan.priority}
        </span>
      </div>
      <div className="mt-0.5 truncate font-mono text-xs font-semibold text-fg-0 tabular-nums">
        {formatNumber(plan.planned_quantity)} 罐
      </div>
      <div className="truncate text-[10px] text-fg-2">{plan.product_name}</div>
    </button>
  );
}

function RescheduleDialog({
  plan,
  days,
  lines,
  submitting,
  onCancel,
  onConfirm,
}: {
  plan: ProductionPlan;
  days: { date: string; monthDay: string; label: string }[];
  lines: ProductionLine[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (date: string, lineCode: string) => void;
}) {
  const [newDate, setNewDate] = useState(plan.plan_date);
  const [newLine, setNewLine] = useState(plan.line_code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="w-[440px]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-line py-3">
          <CardTitle className="flex items-center gap-2 font-mono text-sm">
            <ArrowRightLeft className="h-4 w-4 text-accent" />
            调整排产计划
          </CardTitle>
          <button onClick={onCancel} className="text-fg-2 hover:text-fg-0">
            ×
          </button>
        </CardHeader>
        <CardContent className="space-y-3 py-4">
          <div className="rounded-sm border border-line bg-bg-0 p-2.5 text-xs">
            <div className="font-mono text-fg-2">工单：{plan.work_order_no}</div>
            <div className="text-fg-1">{plan.product_name}</div>
            <div className="mt-1 font-mono text-fg-2">
              原计划：{plan.plan_date} · {plan.line_name} · {formatNumber(plan.planned_quantity)} 罐
            </div>
          </div>

          <div>
            <div className="mb-1 font-mono text-xs text-fg-2">新日期（限未开工/已开工未完工）</div>
            <select
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 w-full rounded-sm border border-line bg-bg-0 px-2 font-mono text-sm text-fg-0 outline-none focus:border-line-strong"
            >
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.monthDay} {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 font-mono text-xs text-fg-2">新产线</div>
            <select
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              className="h-9 w-full rounded-sm border border-line bg-bg-0 px-2 font-mono text-sm text-fg-0 outline-none focus:border-line-strong"
            >
              {lines.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>只能调整未开工或已开工未完工的工单。已完工/已关闭工单不可调整。</span>
          </div>
        </CardContent>
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" onClick={onCancel} size="sm">
            取消
          </Button>
          <Button
            size="sm"
            disabled={submitting || (newDate === plan.plan_date && newLine === plan.line_code)}
            onClick={() => onConfirm(newDate, newLine)}
          >
            {submitting ? "调整中..." : "确认调整"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
