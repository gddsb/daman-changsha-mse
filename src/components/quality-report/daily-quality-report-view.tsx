"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RefreshCw, FileText, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { addDays, getProductionDate } from "@/lib/date-utils";
import { PROCESS_SEQUENCE, PROCESS_STATUS_TONE } from "@/lib/constants";
import type { DailyQualityReport, ProductionLine } from "@/types/mes";

export function DailyQualityReportView() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<DailyQualityReport[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [date, setDate] = useState<string>(getProductionDate());
  const [lineCode, setLineCode] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (lineCode !== "all") params.set("line_code", lineCode);
      const [rRes, lRes] = await Promise.all([
        fetch(`/api/daily-quality-reports?${params}`),
        fetch("/api/production-lines"),
      ]);
      const r = await rRes.json();
      const l = await lRes.json();
      if (r.success) setReports(r.data);
      if (l.success) setLines(l.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [date, lineCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = reports.reduce((s, r) => s + r.total_inspected, 0);
  const good = reports.reduce((s, r) => s + r.total_good, 0);
  const scrap = reports.reduce((s, r) => s + r.total_scrap, 0);
  const passRate = total > 0 ? good / total : 0;

  // 按工序 × 线 透视
  const byProcess: Record<string, Record<string, { inspected: number; good: number; scrap: number }>> = {};
  for (const r of reports) {
    if (!byProcess[r.process_name]) byProcess[r.process_name] = {};
    if (!byProcess[r.process_name][r.line_code]) {
      byProcess[r.process_name][r.line_code] = { inspected: 0, good: 0, scrap: 0 };
    }
    byProcess[r.process_name][r.line_code].inspected += r.total_inspected;
    byProcess[r.process_name][r.line_code].good += r.total_good;
    byProcess[r.process_name][r.line_code].scrap += r.total_scrap;
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-line bg-bg-1 px-6 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-fg-2" />
          <h1 className="font-mono text-base font-semibold text-fg-0">生产质量日报</h1>
          <span className="font-mono text-xs text-fg-2">
            {date} · {reports.length} 条记录
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDate(getProductionDate(addDays(new Date(date), -1)))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 rounded-sm border border-line bg-bg-0 px-2 font-mono text-xs text-fg-1 outline-none focus:border-line-strong"
          />
          <Button size="sm" variant="ghost" onClick={() => setDate(getProductionDate(addDays(new Date(date), 1)))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <select
            value={lineCode}
            onChange={(e) => setLineCode(e.target.value)}
            className="h-8 rounded-sm border border-line bg-bg-0 px-2 font-mono text-xs text-fg-1 outline-none focus:border-line-strong"
          >
            <option value="all">全部产线</option>
            {lines.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* 汇总卡片 */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          <SummaryCard
            icon={<BarChart3 className="h-3.5 w-3.5 text-accent" />}
            label="检验总数"
            value={formatNumber(total)}
            unit="罐"
            tone="accent"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-ok" />}
            label="合格数"
            value={formatNumber(good)}
            unit="罐"
            tone="ok"
          />
          <SummaryCard
            icon={<AlertTriangle className="h-3.5 w-3.5 text-err" />}
            label="不良数"
            value={formatNumber(scrap)}
            unit="罐"
            tone="err"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-ok" />}
            label="一次合格率"
            value={formatPercent(passRate)}
            unit=""
            tone={passRate >= 0.98 ? "ok" : passRate >= 0.95 ? "warn" : "err"}
          />
        </div>

        {/* 按工序 × 产线 透视 */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="font-mono text-sm">各工序检验汇总（按产线）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton className="h-32" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-line-strong bg-bg-2 text-fg-2">
                      <th className="px-3 py-2 text-left">工序</th>
                      {lines.map((l) => (
                        <th key={l.code} colSpan={3} className="border-l border-line px-3 py-2 text-center">
                          {l.name}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-line bg-bg-1 text-fg-2">
                      <th className="px-3 py-1.5"></th>
                      {lines.flatMap((l) => [
                        <th key={`${l.code}-i`} className="border-l border-line px-2 py-1 text-right">检验数</th>,
                        <th key={`${l.code}-g`} className="px-2 py-1 text-right">合格数</th>,
                        <th key={`${l.code}-p`} className="px-2 py-1 text-right">合格率</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {PROCESS_SEQUENCE.map((proc) => {
                      const row = byProcess[proc.name];
                      return (
                        <tr key={proc.name} className="border-b border-line/60 hover:bg-bg-3/50">
                          <td className="px-3 py-2 text-fg-1">{proc.name}</td>
                          {lines.flatMap((l) => {
                            const cell = row?.[l.code];
                            const inspected = cell?.inspected ?? 0;
                            const goodC = cell?.good ?? 0;
                            const rate = inspected > 0 ? goodC / inspected : 0;
                            const tone =
                              inspected === 0
                                ? "text-fg-3"
                                : rate >= 0.99
                                ? "text-ok"
                                : rate >= 0.97
                                ? "text-warn"
                                : "text-err";
                            return [
                              <td key={`${proc.name}-${l.code}-i`} className="border-l border-line px-2 py-2 text-right tabular-nums text-fg-1">
                                {inspected === 0 ? "—" : formatNumber(inspected)}
                              </td>,
                              <td key={`${proc.name}-${l.code}-g`} className="px-2 py-2 text-right tabular-nums text-fg-0">
                                {goodC === 0 ? "—" : formatNumber(goodC)}
                              </td>,
                              <td key={`${proc.name}-${l.code}-p`} className={`px-2 py-2 text-right tabular-nums ${tone}`}>
                                {inspected === 0 ? "—" : formatPercent(rate)}
                              </td>,
                            ];
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 明细列表 */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="font-mono text-sm">检验明细</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton className="h-20" /></div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center font-mono text-sm text-fg-2">
                当日尚无质量数据
                <div className="mt-1 text-xs text-fg-3">
                  系统会从各工序的报工数据自动生成
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-line-strong bg-bg-2 text-fg-2">
                      <th className="px-3 py-2 text-left">产线</th>
                      <th className="px-3 py-2 text-left">工序</th>
                      <th className="px-3 py-2 text-left">产品</th>
                      <th className="px-3 py-2 text-left">规格</th>
                      <th className="px-3 py-2 text-right">检验数</th>
                      <th className="px-3 py-2 text-right">合格数</th>
                      <th className="px-3 py-2 text-right">不良数</th>
                      <th className="px-3 py-2 text-right">合格率</th>
                      <th className="px-3 py-2 text-right">不良率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-line/60 hover:bg-bg-3/50">
                        <td className="px-3 py-2 text-fg-1">{r.line_name}</td>
                        <td className="px-3 py-2 text-fg-0">{r.process_name}</td>
                        <td className="px-3 py-2 text-fg-1">{r.product_name}</td>
                        <td className="px-3 py-2 text-fg-2">{r.can_spec ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-fg-1">{formatNumber(r.total_inspected)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ok">{formatNumber(r.total_good)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-err">{formatNumber(r.total_scrap)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span
                            className={
                              r.pass_rate >= 0.99
                                ? "text-ok"
                                : r.pass_rate >= 0.97
                                ? "text-warn"
                                : "text-err"
                            }
                          >
                            {formatPercent(r.pass_rate)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-err">
                          {formatPercent(r.scrap_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: "ok" | "warn" | "err" | "accent";
}) {
  const toneClass = {
    ok: "text-ok",
    warn: "text-warn",
    err: "text-err",
    accent: "text-accent",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-fg-2">{label}</span>
          {icon}
        </div>
        <div className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
          {unit && <span className="ml-1 text-xs text-fg-2">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
