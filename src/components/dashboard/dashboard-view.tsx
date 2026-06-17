/**
 * 生产看板主视图（制罐业务版）
 * - 4 个 KPI：今日产量 / 合格率 / 排产 / 7日趋势
 * - 产线状态：A/B 线产量、计划达成、合格率
 * - 7 日产量趋势图
 * - 工序不良率排行
 * - 在制工单列表
 * - 最近不良事件
 */

"use client";

import { Fragment, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Factory,
  RefreshCw,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { OutputTrendChart } from "./output-trend-chart";
import { LineStatusCard } from "./line-status-card";
import { KpiCard } from "./kpi-card";
import type { DashboardSummary } from "@/types/mes";

export function DashboardView() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
    const json = await res.json();
    if (json.success) {
      setData(json.data);
      setLastRefresh(new Date());
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* 顶部标题 + 刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">生产看板</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            数据更新于 {lastRefresh.toLocaleTimeString("zh-CN")} · 自动 30 秒刷新
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load()}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          立即刷新
        </Button>
      </div>

      {/* 4 个 KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="今日产量"
          value={data.today.completedQty}
          unit="罐"
          trend={data.today.delta}
          target={data.today.plannedQty}
          icon={<Factory className="h-4 w-4" />}
          tone="sky"
        />
        <KpiCard
          title="今日合格率"
          value={data.quality.firstPassRate}
          unit="%"
          target={98}
          trend={0.4}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="emerald"
          isPercent
        />
        <KpiCard
          title="在制工单"
          value={data.activeWorkOrders.length}
          unit="个"
          icon={<Activity className="h-4 w-4" />}
          tone="amber"
        />
        <KpiCard
          title="今日不良"
          value={data.quality.defectCount}
          unit="罐"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="rose"
        />
      </div>

      {/* 产线状态 + 产量趋势 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LineStatusCard lines={data.lineStatus} />
        </div>
        <div className="lg:col-span-2">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">
                7 日产量趋势
              </CardTitle>
              <Badge
                variant="outline"
                className="border-orange-500/40 bg-orange-500/10 text-orange-400"
              >
                <TrendingUp className="mr-1 h-3 w-3" />
                滚动
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <OutputTrendChart data={data.outputTrend} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 工序不良 + 在制工单 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="border-b border-slate-800 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              工序不良率排行
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-3 pb-3">
            <div className="grid grid-cols-[1fr_2.2fr] gap-x-2 gap-y-1 text-[11px]">
              <div className="text-slate-500 font-medium pb-1 border-b border-slate-800">工序</div>
              <div className="grid grid-cols-3 gap-1 pb-1 border-b border-slate-800 text-slate-500 font-medium">
                <span className="text-center">今日</span>
                <span className="text-center">昨日</span>
                <span className="text-center">本月</span>
              </div>
              {data.processDefectStats.map((p) => {
                const tone = (r: number) =>
                  r > 2
                    ? "text-rose-400"
                    : r > 0.5
                      ? "text-amber-400"
                      : r > 0
                        ? "text-emerald-400"
                        : "text-slate-600";
                const fmtRate = (r: number) =>
                  r > 0 ? `${r.toFixed(2)}%` : "—";
                const renderCell = (rate: number, inspected: number, scrap: number) => (
                  <div className="text-center">
                    <div className={`font-mono tabular-nums ${tone(rate)}`}>{fmtRate(rate)}</div>
                    <div className="text-[10px] text-slate-600 font-mono tabular-nums">
                      {inspected > 0 ? `${scrap}/${inspected}` : "0/0"}
                    </div>
                  </div>
                );
                return (
                  <Fragment key={p.process}>
                    <div className="text-slate-300 truncate py-1.5 border-b border-slate-800/40">
                      {p.process}
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/40">
                      {renderCell(p.today.scrapRate, p.today.inspected, p.today.scrap)}
                      {renderCell(p.yesterday.scrapRate, p.yesterday.inspected, p.yesterday.scrap)}
                      {renderCell(p.month.scrapRate, p.month.inspected, p.month.scrap)}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">在制工单</CardTitle>
            <Badge
              variant="outline"
              className="border-slate-700 text-slate-400"
            >
              {data.activeWorkOrders.length} 个
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {data.activeWorkOrders.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-500">
                  暂无在制工单
                </p>
              )}
              {data.activeWorkOrders.map((wo) => {
                const pct =
                  wo.quantity > 0 ? (wo.completed_quantity / wo.quantity) * 100 : 0;
                return (
                  <div
                    key={wo.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40"
                  >
                    <Badge
                      variant="outline"
                      className="border-slate-700 bg-slate-800 font-mono text-[10px] text-slate-300"
                    >
                      {wo.line_code ?? "--"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-orange-400">
                          {wo.order_no}
                        </span>
                        <span className="truncate text-xs text-slate-300">
                          {wo.product_name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="font-mono">
                          {wo.completed_quantity.toLocaleString()} / {wo.quantity.toLocaleString()} 罐
                        </span>
                        <Progress
                          value={pct}
                          className="h-1 flex-1 bg-slate-800 [&>div]:bg-orange-500"
                        />
                        <span className="font-mono text-slate-400">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近不良事件 */}
      {data.recentDefects.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="border-b border-slate-800 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              最近不良事件
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {data.recentDefects.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-2 text-xs"
                >
                  <span className="font-mono text-orange-400">{d.work_order_no}</span>
                  <span className="text-slate-300">{d.product_name}</span>
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-[10px] text-slate-400"
                  >
                    {d.line_name ?? "--"} · {d.process_name}
                  </Badge>
                  <span className="font-mono text-rose-400">
                    报废 {d.scrap_quantity}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-slate-500">
                    {d.reported_at?.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
