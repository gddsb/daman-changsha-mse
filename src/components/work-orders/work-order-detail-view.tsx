"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { ReportDialog } from "@/components/work-orders/report-dialog";
import {
  ArrowLeft,
  Factory,
  History,
  Package,
  AlertCircle,
  FileText,
  Play,
} from "lucide-react";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { WO_STATUS_LABELS } from "@/lib/constants";
import type { WorkOrder, WorkOrderOperation, WorkOrderReport } from "@/types/mes";

type DetailResponse = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
};

export function WorkOrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<WorkOrderReport[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<WorkOrderReport | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/work-orders/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.success) setData(j.data as DetailResponse);
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReports = useCallback(async () => {
    try {
      const r = await fetch(`/api/reports?work_order_id=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.success) setReports(j.data);
    } catch (e) {
      console.error("fetch reports error", e);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    fetchReports();
  }, [fetchData, fetchReports]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>未找到该工单</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => router.back()}>
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { workOrder: wo, operations } = data;
  const completion = wo.quantity > 0
    ? Math.min(100, Math.round((wo.completed_quantity / wo.quantity) * 100))
    : 0;

  const canReport = wo.status === "生产中";
  const hasOpenReport = reports.some((r) => !r.is_closed);

  return (
    <div className="space-y-4 p-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold text-foreground">{wo.order_no}</h1>
              <StatusBadge kind="workOrder" value={wo.status} />
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {wo.product_name} <span className="font-mono">({wo.product_code})</span>
              {wo.specification && wo.specification !== "—" && (
                <span className="ml-2 text-xs">规格: {wo.specification}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canReport && !hasOpenReport && (
            <Button
              onClick={() => {
                setEditingReport(null);
                setShowReportDialog(true);
              }}
              className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Play className="h-4 w-4" />
              开始报工
            </Button>
          )}
          {canReport && hasOpenReport && (
            <Button
              variant="outline"
              onClick={() => {
                const open = reports.find((r) => !r.is_closed);
                if (open) {
                  setEditingReport(open);
                  setShowReportDialog(true);
                }
              }}
              className="gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
            >
              <FileText className="h-4 w-4" />
              继续报工
            </Button>
          )}
        </div>
      </div>

      {/* 工单基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            工单信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Field label="工单号" value={wo.order_no} mono />
            <Field label="销售订单" value={wo.sales_order_no} mono />
            <Field label="客户" value={wo.customer_name} />
            <Field label="订单类型" value={wo.order_type} />
            <Field label="车间" value={wo.workshop} />
            <Field label="产线" value={wo.line_name} />
            <Field label="计划数量" value={formatNumber(wo.quantity) + " " + wo.unit} mono />
            <Field label="已完工" value={formatNumber(wo.completed_quantity) + " " + wo.unit} mono />
            <Field label="不良数" value={formatNumber(wo.scrap_quantity) + " " + wo.unit} mono />
            <Field label="计划开始" value={wo.planned_start_date === "—" ? "—" : formatDate(wo.planned_start_date)} />
            <Field label="计划结束" value={wo.planned_end_date === "—" ? "—" : formatDate(wo.planned_end_date)} />
            <Field label="实际开始" value={wo.actual_start_date === "—" ? "—" : formatDateTime(wo.actual_start_date)} />
            <Field label="实际结束" value={wo.actual_end_date === "—" ? "—" : formatDateTime(wo.actual_end_date)} />
            <Field label="创建时间" value={formatDateTime(wo.created_at)} />
            <Field label="更新时间" value={formatDateTime(wo.updated_at)} />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>完成进度</span>
              <span className="font-mono">{completion}%</span>
            </div>
            <ProgressBar value={completion} />
          </div>

          {wo.notes && wo.notes !== "—" && (
            <div className="mt-3 rounded border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              备注: {wo.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 报工批次列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              报工批次（{reports.length}）
            </span>
            {reports.length > 0 && (
              <Button variant="ghost" size="sm" onClick={fetchReports} className="text-xs text-fg-2">
                刷新
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              暂无报工批次
              {canReport && (
                <span className="ml-1 text-orange-500">点击右上「开始报工」创建第一批次</span>
              )}
              {!canReport && wo.status !== "生产中" && (
                <span className="ml-1 text-fg-3">（工单需先开工才能报工）</span>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className={
                    "rounded border px-3 py-2 text-sm " +
                    (r.is_closed
                      ? "border-line bg-bg-1/40"
                      : "border-amber-500/30 bg-amber-500/5")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-fg-0">#{r.completion_seq}</span>
                      <span className="font-mono text-fg-0">{r.batch_no}</span>
                      <span className="text-xs text-fg-2">
                        开工 {formatDateTime(r.start_time)}
                      </span>
                      {r.end_time && (
                        <span className="text-xs text-fg-2">
                          完工 {formatDateTime(r.end_time)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-fg-1">
                        投入 {r.input_quantity} / 合格 {r.pass_quantity} / 不良 {r.fail_quantity}
                      </span>
                      {r.is_closed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                          {r.close_type === "auto" ? "自动关闭" : "手工关闭"}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingReport(r);
                            setShowReportDialog(true);
                          }}
                          className="h-6 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                        >
                          录入工序 / 结束
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 工序路线 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="h-4 w-4" />
            工序路线（{operations.length} 道）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">暂无工序</div>
          ) : (
            <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
              {operations.map((op) => (
                <li
                  key={op.id}
                  className="flex items-center gap-2 rounded border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-background font-mono text-xs">
                    {op.sequence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">
                      {op.operation_name || op.operation_code || "—"}
                    </div>
                    {op.operation_code && op.operation_name && op.operation_code !== "—" && (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {op.operation_code}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* 备注 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            变更记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              <span className="font-mono">{formatDateTime(wo.created_at)}</span> — 工单创建
            </li>
            <li>
              <span className="font-mono">{formatDateTime(wo.updated_at)}</span> — 最近更新
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 报工弹窗 */}
      {showReportDialog && (
        <ReportDialog
          open={showReportDialog}
          onOpenChange={(o) => {
            setShowReportDialog(o);
            if (!o) {
              setEditingReport(null);
              fetchReports();
            }
          }}
          workOrder={wo}
          operations={operations}
          editingReport={editingReport}
          onSuccess={() => {
            fetchReports();
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-0.5 " + (mono ? "font-mono" : "") + " text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}
