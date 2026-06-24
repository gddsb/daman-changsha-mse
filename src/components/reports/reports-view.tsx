"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  FileText,
  ChevronRight,
  CheckCircle2,
  Clock,
  ClipboardList,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import type { WorkOrderReport } from "@/types/mes";

export function ReportsView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<WorkOrderReport[]>([]);
  const [keyword, setKeyword] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setReports(json.data);
    } catch (e) {
      console.error("fetch reports error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = reports.filter((r) => {
    if (!keyword.trim()) return true;
    const k = keyword.toLowerCase();
    return (
      r.work_order_no.toLowerCase().includes(k) ||
      r.batch_no.toLowerCase().includes(k) ||
      r.report_no.toLowerCase().includes(k) ||
      r.product_code.toLowerCase().includes(k) ||
      r.product_name.toLowerCase().includes(k)
    );
  });

  const stats = {
    total: reports.length,
    running: reports.filter((r) => !r.is_closed).length,
    closed: reports.filter((r) => r.is_closed).length,
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-slate-100">生产报工</h1>
          <span className="text-xs text-slate-400 ml-2">
            工单开工后才能进行报工；同一工单已有进行中批次时需先关闭
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          刷新
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-800">
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <div className="text-xs text-slate-400">报工批次总数</div>
          <div className="text-2xl font-mono tabular-nums text-slate-100 mt-1">{stats.total}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <div className="text-xs text-slate-400">进行中</div>
          <div className="text-2xl font-mono tabular-nums text-amber-500 mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {stats.running}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded p-3">
          <div className="text-xs text-slate-400">已关闭</div>
          <div className="text-2xl font-mono tabular-nums text-emerald-500 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {stats.closed}
          </div>
        </div>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800">
        <input
          type="text"
          placeholder="搜索 工单号 / 生产批号 / 报工编号 / 产品编号 / 产品名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/50"
        />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto px-6 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-900" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2 text-slate-500" />
            <div className="text-sm">暂无报工数据</div>
            <div className="text-xs text-slate-500 mt-1">
              请到「工单管理」→ 选择已开工的工单 → 点击「开始报工」按钮
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
            {/* 表头：固定列宽，产品名称自适应换行 */}
            <div className="grid grid-cols-[130px_160px_110px_minmax(150px,1fr)_80px_50px_110px_100px_100px_200px_60px_120px_150px] gap-0 bg-slate-800 border-b border-slate-800 text-xs text-slate-300 font-medium">
              <div className="px-3 py-2.5">报工编号</div>
              <div className="px-3 py-2.5">工单号</div>
              <div className="px-3 py-2.5">产品编号</div>
              <div className="px-3 py-2.5">产品名称</div>
              <div className="px-3 py-2.5">产品规格</div>
              <div className="px-3 py-2.5">完工顺序</div>
              <div className="px-3 py-2.5">生产批号</div>
              <div className="px-3 py-2.5">开工时间</div>
              <div className="px-3 py-2.5">完工时间</div>
              <div className="px-3 py-2.5 text-right">投入/合格/不良</div>
              <div className="px-3 py-2.5">人员</div>
              <div className="px-3 py-2.5 text-center">状态</div>
              <div className="px-3 py-2.5 text-right">操作</div>
            </div>
            {filtered.map((r) => {
              const openable = !r.is_closed;
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-[130px_160px_110px_minmax(150px,1fr)_80px_50px_110px_100px_100px_200px_60px_120px_150px] gap-0 border-b border-slate-800/60 text-sm items-center ${
                    openable
                      ? "hover:bg-slate-700/60 cursor-pointer"
                      : "hover:bg-slate-800/40"
                  }`}
                  onClick={() => {
                    if (openable) router.push(`/reports/${r.id}`);
                  }}
                >
                  <div className="px-3 py-2.5 font-mono text-xs text-slate-300 truncate" title={r.report_no}>
                    {r.report_no}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-slate-100 truncate">{r.work_order_no}</div>
                  <div className="px-3 py-2.5 font-mono text-slate-100 truncate">{r.product_code}</div>
                  <div className="px-3 py-2.5 text-slate-100 break-words">{r.product_name}</div>
                  <div className="px-3 py-2.5 text-slate-300 truncate text-xs">{r.specification}</div>
                  <div className="px-3 py-2.5 font-mono text-slate-100">#{r.completion_seq}</div>
                  <div className="px-3 py-2.5 font-mono text-slate-100 truncate">{r.batch_no}</div>
                  <div className="px-3 py-2.5 font-mono text-xs text-slate-300">
                    {r.start_time ? formatDate(r.start_time) : "—"}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-xs text-slate-300">
                    {r.end_time ? formatDate(r.end_time) : "—"}
                  </div>
                  <div className="px-3 py-2.5 font-mono tabular-nums text-slate-100 text-right text-xs whitespace-nowrap">
                    {r.input_quantity} / {r.pass_quantity} / {r.fail_quantity}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-xs text-slate-300 text-center">
                    {r.skilled_worker_count + r.regular_worker_count + r.contract_worker_count + r.other_worker_count}
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    {r.is_closed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        已关闭
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
                        <Clock className="w-3 h-3" />
                        进行中
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-end gap-1.5">
                    {openable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/reports/${r.id}`);
                        }}
                      >
                        <ClipboardList className="mr-1 h-3.5 w-3.5" />
                        工序报工
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-slate-400 hover:text-slate-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/reports/${r.id}`);
                        }}
                        title="查看详情"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}