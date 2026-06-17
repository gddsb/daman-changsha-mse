"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ClipboardCheck, AlertCircle, Plus, ChevronDown } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";
import { INSPECTION_RESULT_TONE, INSPECTION_RESULT_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/constants";
import type { QualityInspection, DefectCode } from "@/types/mes";

export function QualityInspectionView() {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [defectCodes, setDefectCodes] = useState<DefectCode[]>([]);
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (resultFilter !== "all") params.set("result", resultFilter);
      if (typeFilter !== "all") params.set("inspection_type", typeFilter);
      const r = await fetch(`/api/quality/inspections?${params}`);
      const data = await r.json();
      if (data.success) {
        setInspections(data.data.inspections);
        setDefectCodes(data.data.defectCodes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [resultFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const passCount = inspections.filter((i) => i.result === "pass").length;
  const failCount = inspections.filter((i) => i.result === "fail").length;
  const condCount = inspections.filter((i) => i.result === "conditional").length;
  const passRate = inspections.length > 0 ? passCount / inspections.length : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line bg-bg-1 px-6 py-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-4 w-4 text-fg-2" />
          <h1 className="font-mono text-base font-semibold text-fg-0">质量检验</h1>
          <span className="font-mono text-xs text-fg-2">
            {inspections.length} 条记录 · 合格率 {formatNumber(passRate * 100, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-sm border border-line bg-bg-0 px-2 font-mono text-xs text-fg-1 outline-none focus:border-line-strong"
          >
            <option value="all">全部类型</option>
            <option value="first">首件</option>
            <option value="patrol">巡检</option>
            <option value="final">末件</option>
            <option value="incoming">入库检</option>
          </select>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="h-8 rounded-sm border border-line bg-bg-0 px-2 font-mono text-xs text-fg-1 outline-none focus:border-line-strong"
          >
            <option value="all">全部结果</option>
            <option value="pass">合格</option>
            <option value="fail">不合格</option>
            <option value="conditional">让步接收</option>
          </select>
          <Button size="sm" variant="ghost" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowNew((s) => !s)}>
            <Plus className="h-3.5 w-3.5" />
            新增检验
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* 汇总卡片 */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          <StatCard label="总检验数" value={inspections.length.toString()} tone="info" />
          <StatCard label="合格数" value={passCount.toString()} tone="ok" />
          <StatCard label="不合格数" value={failCount.toString()} tone="err" />
          <StatCard label="让步接收" value={condCount.toString()} tone="warn" />
        </div>

        {showNew && (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <CardTitle className="font-mono text-sm">新增检验记录</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-fg-2">
              <div className="rounded border border-line-strong bg-bg-2 p-3 font-mono text-xs">
                提示：检验数据通常随工序报工自动生成。如需独立登记，请通过工单详情页的工序卡片提交。
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="font-mono text-sm">检验记录列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton className="h-32" /></div>
            ) : inspections.length === 0 ? (
              <div className="p-8 text-center font-mono text-sm text-fg-2">
                暂无检验记录
                <div className="mt-1 text-xs text-fg-3">
                  工序报工时会自动创建检验记录
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-line-strong bg-bg-2 text-fg-2">
                      <th className="px-3 py-2 text-left">检验单号</th>
                      <th className="px-3 py-2 text-left">工单</th>
                      <th className="px-3 py-2 text-left">产线/工序</th>
                      <th className="px-3 py-2 text-left">产品</th>
                      <th className="px-3 py-2 text-right">样本</th>
                      <th className="px-3 py-2 text-left">类型</th>
                      <th className="px-3 py-2 text-left">结果</th>
                      <th className="px-3 py-2 text-left">不良代码</th>
                      <th className="px-3 py-2 text-left">检验员</th>
                      <th className="px-3 py-2 text-left">检验时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.map((i) => (
                      <tr key={i.id} className="border-b border-line/60 hover:bg-bg-3/50">
                        <td className="px-3 py-2 text-fg-0">{i.inspection_no}</td>
                        <td className="px-3 py-2 text-fg-1">{i.work_order_no ?? "—"}</td>
                        <td className="px-3 py-2 text-fg-1">
                          {i.line_name ?? "—"} · {i.process_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-fg-1">{i.product_name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-fg-0">{i.sample_size}</td>
                        <td className="px-3 py-2 text-fg-2">
                          {INSPECTION_TYPE_LABELS[i.inspection_type as keyof typeof INSPECTION_TYPE_LABELS] ?? i.inspection_type}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              INSPECTION_RESULT_TONE[i.result as keyof typeof INSPECTION_RESULT_TONE] === "ok"
                                ? "text-ok"
                                : INSPECTION_RESULT_TONE[i.result as keyof typeof INSPECTION_RESULT_TONE] === "warn"
                                ? "text-warn"
                                : "text-err"
                            }
                          >
                            {INSPECTION_RESULT_LABELS[i.result as keyof typeof INSPECTION_RESULT_LABELS] ?? i.result}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-fg-2">{i.defect_name ?? "—"}</td>
                        <td className="px-3 py-2 text-fg-1">{i.inspector_name}</td>
                        <td className="px-3 py-2 text-fg-2">{formatDateTime(i.inspection_time)}</td>
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "err" | "info";
}) {
  const toneClass = {
    ok: "text-ok",
    warn: "text-warn",
    err: "text-err",
    info: "text-info",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="font-mono text-xs text-fg-2">{label}</div>
        <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
