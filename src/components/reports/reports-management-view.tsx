'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';
import type {
  WorkOrder,
  WorkOrderReport,
  OperationReport,
} from '@/types/mes';

interface ReportSummary {
  workOrder: WorkOrder;
  reports: Array<{
    workOrderReport: WorkOrderReport;
    operationReports: OperationReport[];
  }>;
  totalGood: number;
  totalDefect: number;
}

interface ApiResp {
  success: boolean;
  data?: ReportSummary[];
  error?: string;
}

export function ReportsManagementView() {
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/reports', { cache: 'no-store' });
      const json: ApiResp = await resp.json();
      if (!json.success) {
        setError(json.error ?? '查询失败');
        setSummaries([]);
      } else {
        setSummaries(json.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 状态汇总
  const stats = useMemo(() => {
    let totalWorkOrders = summaries.length;
    let totalBatchCount = 0;
    let totalOpReportCount = 0;
    let totalGood = 0;
    let totalDefect = 0;
    for (const s of summaries) {
      totalBatchCount += s.reports.length;
      for (const r of s.reports) {
        totalOpReportCount += r.operationReports.length;
        for (const op of r.operationReports) {
          totalGood += op.qualified_qty;
          totalDefect += op.defect_qty;
        }
      }
      totalGood += s.totalGood;
      totalDefect += s.totalDefect;
    }
    const yieldRate =
      totalGood + totalDefect > 0
        ? (totalGood / (totalGood + totalDefect)) * 100
        : 0;
    return {
      totalWorkOrders,
      totalBatchCount,
      totalOpReportCount,
      totalGood,
      totalDefect,
      yieldRate,
    };
  }, [summaries]);

  // 过滤
  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (statusFilter !== 'all' && s.workOrder.status !== statusFilter) return false;
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        const wo = s.workOrder;
        const hay = [
          wo.order_no,
          wo.product_code,
          wo.product_name,
          wo.customer_name,
          wo.line_name,
          wo.line_code,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [summaries, statusFilter, keyword]);

  const toggleExpand = (woId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶部 KPI 摘要 */}
      <div className="grid grid-cols-2 gap-px border-b border-border/60 bg-border/60 md:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="有报工工单"
          value={String(stats.totalWorkOrders)}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="info"
        />
        <KpiTile
          label="工单报工批次"
          value={String(stats.totalBatchCount)}
          icon={<Package2 className="h-4 w-4" />}
          tone="info"
        />
        <KpiTile
          label="工序报工记录"
          value={String(stats.totalOpReportCount)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="info"
        />
        <KpiTile
          label="累计合格"
          value={stats.totalGood.toLocaleString()}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="ok"
        />
        <KpiTile
          label="累计不良"
          value={stats.totalDefect.toLocaleString()}
          icon={<AlertCircle className="h-4 w-4" />}
          tone="err"
        />
        <KpiTile
          label="合格率"
          value={`${stats.yieldRate.toFixed(2)}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={stats.yieldRate >= 99 ? 'ok' : stats.yieldRate >= 95 ? 'warn' : 'err'}
        />
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-bg-1 px-4 py-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索 MO / 产品 / 客户 / 产线"
          className="h-8 w-64 rounded-sm border border-border/60 bg-bg-0 px-2 text-sm text-fg-0 outline-none focus:border-orange-500/60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-sm border border-border/60 bg-bg-0 px-2 text-sm text-fg-0 outline-none focus:border-orange-500/60"
        >
          <option value="all">全部状态</option>
          <option value="开立">开立</option>
          <option value="下发">下发</option>
          <option value="生产中">生产中</option>
          <option value="暂停">暂停</option>
          <option value="完工">完工</option>
          <option value="超期完工">超期完工</option>
        </select>
        <button
          onClick={fetchData}
          disabled={loading}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-sm border border-border/60 bg-bg-2 px-3 text-sm text-fg-1 transition-colors hover:bg-bg-3 hover:text-fg-0 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-auto">
        {loading && summaries.length === 0 ? (
          <EmptyState loading />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((s) => (
              <WorkOrderReportGroup
                key={s.workOrder.id}
                summary={s}
                expanded={expanded.has(s.workOrder.id)}
                onToggle={() => toggleExpand(s.workOrder.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    err: 'text-rose-400',
    info: 'text-sky-400',
  }[tone];
  return (
    <div className="flex items-center gap-3 bg-bg-1 px-4 py-3">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-sm bg-bg-2', toneCls)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-fg-2">{label}</div>
        <div className={cn('font-mono text-lg tabular-nums', toneCls)}>{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-fg-2">
      <ClipboardList className="mb-2 h-10 w-10 opacity-30" />
      <div className="text-sm">
        {loading ? '加载中...' : '暂无报工数据'}
      </div>
    </div>
  );
}

function WorkOrderReportGroup({
  summary,
  expanded,
  onToggle,
}: {
  summary: ReportSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const wo = summary.workOrder;
  const totalOpReports = summary.reports.reduce(
    (s, r) => s + r.operationReports.length,
    0
  );
  return (
    <div>
      {/* 工单行（折叠头） */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 bg-bg-1 px-4 py-2.5 transition-colors hover:bg-bg-2"
      >
        <button className="text-fg-2 hover:text-fg-0">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <span className="font-mono text-sm text-orange-400">{wo.order_no}</span>
          <span className="truncate text-sm text-fg-0">
            {wo.product_name || wo.product_code}
            {wo.specification && wo.specification !== '-' ? ` / ${wo.specification}` : ''}
          </span>
          <StatusBadge kind="workOrder" value={wo.status} size="sm" />
          {wo.line_name && wo.line_name !== '—' && (
            <span className="rounded-sm border border-border/60 bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-fg-1">
              {wo.line_name}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-6 font-mono text-xs tabular-nums">
          <div className="text-right">
            <div className="text-fg-3">批次</div>
            <div className="text-fg-0">{summary.reports.length}</div>
          </div>
          <div className="text-right">
            <div className="text-fg-3">工序报工</div>
            <div className="text-fg-0">{totalOpReports}</div>
          </div>
          <div className="text-right">
            <div className="text-fg-3">合格 / 不良</div>
            <div className="text-fg-0">
              <span className="text-emerald-400">{summary.totalGood.toLocaleString()}</span>
              <span className="mx-1 text-fg-3">/</span>
              <span className="text-rose-400">{summary.totalDefect.toLocaleString()}</span>
            </div>
          </div>
          <Link
            href={`/work-orders/${wo.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-2 inline-flex h-7 items-center gap-1 rounded-sm border border-orange-500/40 bg-orange-500/10 px-2 text-xs text-orange-400 hover:bg-orange-500/20"
          >
            进入工单
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* 折叠展开：所有批次 + 工序报工 */}
      {expanded && (
        <div className="border-l-2 border-orange-500/30 bg-bg-0">
          {summary.reports.length === 0 ? (
            <div className="px-12 py-4 text-sm text-fg-2">该工单暂无报工批次</div>
          ) : (
            <div className="divide-y divide-border/40">
              {summary.reports.map((r) => (
                <BatchReportRow key={r.workOrderReport.id} batch={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BatchReportRow({
  batch,
}: {
  batch: { workOrderReport: WorkOrderReport; operationReports: OperationReport[] };
}) {
  const r = batch.workOrderReport;
  const batchGood = batch.operationReports.reduce((s, op) => s + op.qualified_qty, 0);
  const batchDefect = batch.operationReports.reduce((s, op) => s + op.defect_qty, 0);
  const totalWorkers = r.skilled_workers + r.general_workers + r.labor_workers;
  return (
    <div className="px-4 py-2.5">
      {/* 批次头 */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-sm border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-xs text-sky-400">
          批号 {r.batch_no}
        </span>
        <span className="flex items-center gap-1 text-xs text-fg-2">
          <Clock className="h-3 w-3" />
          开始 {formatDateTime(r.start_at)}
        </span>
        {r.change_line_at && (
          <span className="text-xs text-fg-2">
            换线 {formatDateTime(r.change_line_at)}
          </span>
        )}
        <span className="text-xs text-fg-2">
          技工/普工/劳务：<span className="font-mono text-fg-1">{r.skilled_workers}</span> /{' '}
          <span className="font-mono text-fg-1">{r.general_workers}</span> /{' '}
          <span className="font-mono text-fg-1">{r.labor_workers}</span>
          <span className="ml-1 text-fg-3">（合计 {totalWorkers}）</span>
        </span>
        <span className="text-xs text-fg-2">
          清场 <span className="font-mono text-fg-1">{r.cleanup_minutes}</span> 分钟
        </span>
        {r.notes && (
          <span className="text-xs text-fg-2">
            · 备注：<span className="text-fg-1">{r.notes}</span>
          </span>
        )}
        <span className="ml-auto font-mono text-xs tabular-nums">
          <span className="text-emerald-400">{batchGood.toLocaleString()}</span>
          <span className="mx-1 text-fg-3">/</span>
          <span className="text-rose-400">{batchDefect.toLocaleString()}</span>
        </span>
      </div>

      {/* 工序报工 */}
      {batch.operationReports.length === 0 ? (
        <div className="ml-4 rounded-sm border border-dashed border-border/60 bg-bg-1 px-3 py-2 text-xs text-fg-2">
          该批次尚未添加工序报工
        </div>
      ) : (
        <div className="ml-4 overflow-hidden rounded-sm border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-xs text-fg-2">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">序</th>
                <th className="px-3 py-1.5 text-left font-medium">工序</th>
                <th className="px-3 py-1.5 text-left font-medium">物料编码 / 名称</th>
                <th className="px-3 py-1.5 text-left font-medium">物料批次</th>
                <th className="px-3 py-1.5 text-right font-medium">投入</th>
                <th className="px-3 py-1.5 text-right font-medium">不良</th>
                <th className="px-3 py-1.5 text-right font-medium">合格</th>
                <th className="px-3 py-1.5 text-left font-medium">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono tabular-nums">
              {batch.operationReports.map((op) => (
                <tr key={op.id} className="text-fg-0 hover:bg-bg-1">
                  <td className="px-3 py-1.5 text-fg-2">{op.sequence}</td>
                  <td className="px-3 py-1.5 text-fg-1">{op.process_name || '—'}</td>
                  <td className="px-3 py-1.5">
                    {op.material_code || '—'}
                    {op.material_name ? (
                      <span className="ml-1 text-fg-2">/ {op.material_name}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5 text-fg-1">
                    {op.material_batch_no || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">{op.input_qty}</td>
                  <td className="px-3 py-1.5 text-right text-rose-400">{op.defect_qty}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-400">
                    {op.qualified_qty}
                  </td>
                  <td className="px-3 py-1.5 text-fg-2">{op.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
