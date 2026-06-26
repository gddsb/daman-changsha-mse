"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  
  // 筛选条件
  const [filterWorkOrderNo, setFilterWorkOrderNo] = useState("");
  const [filterProductCode, setFilterProductCode] = useState("");
  const [filterSpecification, setFilterSpecification] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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

  // 提取各列的唯一值用于筛选下拉框
  const uniqueWorkOrderNos = useMemo(() => 
    [...new Set(reports.map(r => r.work_order_no))].sort(),
    [reports]
  );
  const uniqueProductCodes = useMemo(() => 
    [...new Set(reports.map(r => r.product_code))].sort(),
    [reports]
  );
  const uniqueSpecifications = useMemo(() => 
    [...new Set(reports.map(r => r.specification).filter(Boolean))].sort(),
    [reports]
  );
  const uniqueBatchNos = useMemo(() => 
    [...new Set(reports.map(r => r.batch_no))].sort(),
    [reports]
  );

  const filtered = useMemo(() => reports.filter((r) => {
    // 关键词搜索
    if (keyword.trim()) {
      const k = keyword.toLowerCase();
      if (!(
        r.work_order_no.toLowerCase().includes(k) ||
        r.batch_no.toLowerCase().includes(k) ||
        r.report_no.toLowerCase().includes(k) ||
        r.product_code.toLowerCase().includes(k) ||
        r.product_name.toLowerCase().includes(k)
      )) return false;
    }
    
    // 列筛选
    if (filterWorkOrderNo && r.work_order_no !== filterWorkOrderNo) return false;
    if (filterProductCode && r.product_code !== filterProductCode) return false;
    if (filterSpecification && r.specification !== filterSpecification) return false;
    if (filterBatchNo && r.batch_no !== filterBatchNo) return false;
    if (filterStatus === "进行中" && r.is_closed) return false;
    if (filterStatus === "已关闭" && !r.is_closed) return false;
    
    return true;
  }), [reports, keyword, filterWorkOrderNo, filterProductCode, filterSpecification, filterBatchNo, filterStatus]);

  const stats = {
    total: reports.length,
    running: reports.filter((r) => !r.is_closed).length,
    closed: reports.filter((r) => r.is_closed).length,
  };

  // 清除所有筛选
  const clearFilters = () => {
    setKeyword("");
    setFilterWorkOrderNo("");
    setFilterProductCode("");
    setFilterSpecification("");
    setFilterBatchNo("");
    setFilterStatus("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">生产报工</h1>
          <span className="text-xs text-muted-foreground ml-2">
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
      <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-border">
        <div className="bg-card border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">报工批次总数</div>
          <div className="text-2xl font-mono tabular-nums text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">进行中</div>
          <div className="text-2xl font-mono tabular-nums text-warning mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {stats.running}
          </div>
        </div>
        <div className="bg-card border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">已关闭</div>
          <div className="text-2xl font-mono tabular-nums text-success mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {stats.closed}
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col gap-3 px-6 py-3 border-b border-border">
        {/* 关键词搜索 */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="搜索 工单号 / 生产批号 / 报工编号 / 产品编号 / 产品名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          {(keyword || filterWorkOrderNo || filterProductCode || filterSpecification || filterBatchNo || filterStatus) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              清除筛选
            </Button>
          )}
        </div>
        
        {/* 列筛选下拉框 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">工单号:</span>
            <select
              value={filterWorkOrderNo}
              onChange={(e) => setFilterWorkOrderNo(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 min-w-[120px]"
            >
              <option value="">全部</option>
              {uniqueWorkOrderNos.map(no => (
                <option key={no} value={no}>{no}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">产品编号:</span>
            <select
              value={filterProductCode}
              onChange={(e) => setFilterProductCode(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 min-w-[100px]"
            >
              <option value="">全部</option>
              {uniqueProductCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">产品规格:</span>
            <select
              value={filterSpecification}
              onChange={(e) => setFilterSpecification(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 min-w-[80px]"
            >
              <option value="">全部</option>
              {uniqueSpecifications.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">生产批号:</span>
            <select
              value={filterBatchNo}
              onChange={(e) => setFilterBatchNo(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 min-w-[100px]"
            >
              <option value="">全部</option>
              {uniqueBatchNos.map(no => (
                <option key={no} value={no}>{no}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">状态:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 min-w-[80px]"
            >
              <option value="">全部</option>
              <option value="进行中">进行中</option>
              <option value="已关闭">已关闭</option>
            </select>
          </div>
          
          <span className="text-xs text-muted-foreground ml-2">
            筛选结果: {filtered.length} 条
          </span>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto px-6 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mb-2 text-muted-foreground" />
            <div className="text-sm">暂无报工数据</div>
            <div className="text-xs text-muted-foreground mt-1">
              请到「工单管理」→ 选择已开工的工单 → 点击「开始报工」按钮
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded overflow-hidden">
            {/* 表头：固定列宽，产品名称自适应换行 */}
            <div className="grid grid-cols-[130px_160px_110px_minmax(150px,1fr)_80px_50px_110px_100px_100px_200px_60px_100px_120px] gap-0 bg-muted border-b border-border text-xs text-muted-foreground font-medium">
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
                  className={`grid grid-cols-[130px_160px_110px_minmax(150px,1fr)_80px_50px_110px_100px_100px_200px_60px_100px_120px] gap-0 border-b border-border/60 text-xs items-center ${
                    openable
                      ? "hover:bg-accent/60 cursor-pointer"
                      : "hover:bg-muted/40"
                  }`}
                  onClick={() => {
                    if (openable) router.push(`/reports/${r.id}`);
                  }}
                >
                  <div className="px-3 py-2.5 font-mono text-xs text-muted-foreground truncate" title={r.report_no}>
                    {r.report_no}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-foreground truncate">{r.work_order_no}</div>
                  <div className="px-3 py-2.5 font-mono text-foreground truncate">{r.product_code}</div>
                  <div className="px-3 py-2.5 text-foreground break-words">{r.product_name}</div>
                  <div className="px-3 py-2.5 text-muted-foreground truncate text-xs">{r.specification}</div>
                  <div className="px-3 py-2.5 font-mono text-foreground">#{r.completion_seq}</div>
                  <div className="px-3 py-2.5 font-mono text-foreground truncate">{r.batch_no}</div>
                  <div className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.start_time ? formatDate(r.start_time) : "—"}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.end_time ? formatDate(r.end_time) : "—"}
                  </div>
                  <div className="px-3 py-2.5 font-mono tabular-nums text-foreground text-right text-xs whitespace-nowrap">
                    {r.input_quantity} / {r.pass_quantity} / {r.fail_quantity}
                  </div>
                  <div className="px-3 py-2.5 font-mono text-xs text-muted-foreground text-center">
                    {r.skilled_worker_count + r.regular_worker_count + r.contract_worker_count + r.other_worker_count}
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    {r.is_closed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-success/30 bg-success/10 text-success text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        已关闭
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-warning/30 bg-warning/10 text-warning text-xs">
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
                        className="h-7 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground"
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
                        className="h-7 text-muted-foreground hover:text-foreground"
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