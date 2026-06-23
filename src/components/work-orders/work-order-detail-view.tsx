"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import { ProgressBar } from '@/components/shared/progress-bar';
import {
  ArrowLeft,
  Factory,
  History,
  Package,
  AlertCircle,
} from 'lucide-react';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { WO_STATUS_LABELS } from '@/lib/constants';
import type { WorkOrder, WorkOrderOperation } from '@/types/mes';

type DetailResponse = {
  workOrder: WorkOrder;
  operations: WorkOrderOperation[];
};

export function WorkOrderDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/work-orders/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json?.success) setData(json.data as DetailResponse);
        else setData(null);
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

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
            <Field label="优先级" value={String(wo.priority)} mono />
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
