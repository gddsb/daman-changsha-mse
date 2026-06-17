"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { Search, ShieldCheck, Plus, RefreshCcw, ClipboardCheck, X } from 'lucide-react';
import { formatDateTime, formatPercent, formatNumber } from '@/lib/format';
import { QUALITY_RESULT_OPTIONS, INSPECTION_TYPE_OPTIONS } from '@/lib/constants';
import type { QualityInspection, DefectCode } from '@/types/mes';

export function QualityView() {
  const [inspections, setInspections] = useState<QualityInspection[] | null>(null);
  const [defectCodes, setDefectCodes] = useState<DefectCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    work_order_id: '',
    product_code: '',
    product_name: '',
    batch_no: '',
    inspection_type: 'first',
    sample_size: 1,
    result: 'pass',
    defect_code: '',
    defect_description: '',
    inspector_name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/quality/inspections', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setInspections(json.data.inspections);
        setDefectCodes(json.data.defectCodes);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!inspections) return [];
    return inspections.filter((i) => {
      if (resultFilter !== 'all' && i.result !== resultFilter) return false;
      if (typeFilter !== 'all' && i.inspection_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          i.inspection_no.toLowerCase().includes(s) ||
          i.product_code.toLowerCase().includes(s) ||
          i.product_name.toLowerCase().includes(s) ||
          (i.work_order_no || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [inspections, search, resultFilter, typeFilter]);

  const summary = useMemo(() => {
    if (!inspections) return null;
    const total = inspections.length;
    const pass = inspections.filter((i) => i.result === 'pass').length;
    const fail = inspections.filter((i) => i.result === 'fail').length;
    const first = inspections.filter((i) => i.inspection_type === 'first');
    const firstPass = first.filter((i) => i.result === 'pass').length;
    const firstPassRate = first.length > 0 ? (firstPass / first.length) * 100 : 0;
    const passRate = total > 0 ? (pass / total) * 100 : 0;
    return { total, pass, fail, firstPassRate, passRate };
  }, [inspections]);

  const defectStats = useMemo(() => {
    if (!inspections) return [];
    const map = new Map<string, { code: string; name: string; count: number }>();
    inspections.forEach((i) => {
      if (i.result === 'fail' && i.defect_code) {
        const code = defectCodes.find((d) => d.code === i.defect_code);
        const name = code?.name || i.defect_description || i.defect_code;
        const key = i.defect_code;
        if (!map.has(key)) map.set(key, { code: i.defect_code, name, count: 0 });
        map.get(key)!.count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [inspections, defectCodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/quality/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sample_size: Number(form.sample_size),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setForm({
          work_order_id: '', product_code: '', product_name: '', batch_no: '',
          inspection_type: 'first', sample_size: 1, result: 'pass', defect_code: '',
          defect_description: '', inspector_name: form.inspector_name,
        });
        await load();
      } else {
        alert(json.error || '提交失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">质量管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">首件、巡检、入库检、不良分析</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />刷新
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />新建检验
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="检验总数" value={summary.total} tone="default" />
          <Stat label="合格" value={summary.pass} tone="success" />
          <Stat label="不合格" value={summary.fail} tone="danger" />
          <Stat label="总合格率" value={formatPercent(summary.passRate)} tone={summary.passRate >= 95 ? 'success' : 'warning'} />
          <Stat label="首检合格率" value={formatPercent(summary.firstPassRate)} tone={summary.firstPassRate >= 95 ? 'success' : 'warning'} />
        </div>
      )}

      {defectStats.length > 0 && (
        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">TOP 5 不良代码</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {defectStats.map((d) => {
                const max = Math.max(...defectStats.map((x) => x.count));
                const pct = (d.count / max) * 100;
                return (
                  <div key={d.code} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate font-mono text-xs text-amber-400">{d.code}</span>
                    <span className="w-40 shrink-0 truncate text-xs">{d.name}</span>
                    <div className="flex-1">
                      <div className="h-2 bg-rose-500/20">
                        <div className="h-2 bg-rose-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-sm text-rose-400">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-card/40">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索检验单号 / 工单 / 料号 / 料名"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="全部结果" active={resultFilter === 'all'} onClick={() => setResultFilter('all')} />
              {QUALITY_RESULT_OPTIONS.map((s) => (
                <FilterChip key={s.value} label={s.label} active={resultFilter === s.value} onClick={() => setResultFilter(s.value)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip label="全部类型" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
              {INSPECTION_TYPE_OPTIONS.map((s) => (
                <FilterChip key={s.value} label={s.label} active={typeFilter === s.value} onClick={() => setTypeFilter(s.value)} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm">没有符合条件的检验记录</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">检验单号</th>
                    <th className="px-4 py-3">类型</th>
                    <th className="px-4 py-3">工单</th>
                    <th className="px-4 py-3">物料</th>
                    <th className="px-4 py-3">批次</th>
                    <th className="px-4 py-3 text-right">样本</th>
                    <th className="px-4 py-3">结果</th>
                    <th className="px-4 py-3">不良</th>
                    <th className="px-4 py-3">检验员</th>
                    <th className="px-4 py-3">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="border-b border-border/20 hover:bg-background/30">
                      <td className="px-4 py-3 font-mono text-xs text-amber-400">{i.inspection_no}</td>
                      <td className="px-4 py-3"><StatusBadge kind="inspectionType" value={i.inspection_type} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i.work_order_no || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.product_name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{i.product_code}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{i.batch_no || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{i.sample_size}</td>
                      <td className="px-4 py-3"><StatusBadge kind="qualityResult" value={i.result} /></td>
                      <td className="px-4 py-3">
                        {i.defect_code ? (
                          <div>
                            <div className="font-mono text-xs text-rose-400">{i.defect_code}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{i.defect_description}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{i.inspector_name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{formatDateTime(i.inspection_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-2xl border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4" />新建质量检验
              </CardTitle>
              <button onClick={() => setShowForm(false)} className="rounded-sm p-1 hover:bg-background/50">
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="物料编码">
                    <Input value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} required />
                  </Field>
                  <Field label="物料名称">
                    <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="批次号">
                    <Input value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} />
                  </Field>
                  <Field label="样本数量">
                    <Input type="number" min="1" value={form.sample_size} onChange={(e) => setForm({ ...form, sample_size: Number(e.target.value) })} required />
                  </Field>
                  <Field label="检验员">
                    <Input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} required />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="检验类型">
                    <select
                      value={form.inspection_type}
                      onChange={(e) => setForm({ ...form, inspection_type: e.target.value })}
                      className="w-full rounded-sm border border-input bg-background/40 px-3 py-2 text-sm"
                    >
                      {INSPECTION_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="检验结果">
                    <select
                      value={form.result}
                      onChange={(e) => setForm({ ...form, result: e.target.value })}
                      className="w-full rounded-sm border border-input bg-background/40 px-3 py-2 text-sm"
                    >
                      {QUALITY_RESULT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                {form.result === 'fail' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="不良代码">
                      <select
                        value={form.defect_code}
                        onChange={(e) => setForm({ ...form, defect_code: e.target.value })}
                        className="w-full rounded-sm border border-input bg-background/40 px-3 py-2 text-sm"
                      >
                        <option value="">-- 选择不良代码 --</option>
                        {defectCodes.map((d) => (
                          <option key={d.code} value={d.code}>{d.code} · {d.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="不良描述">
                      <Input value={form.defect_description} onChange={(e) => setForm({ ...form, defect_description: e.target.value })} />
                    </Field>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? '提交中...' : '提交检验'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-400',
  }[tone];
  return (
    <div className="border border-border/40 bg-card/40 p-3">
      <div className={`font-mono text-xl ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-3 py-1 text-xs transition ${
        active
          ? 'border-amber-500/80 bg-amber-500/10 text-amber-300'
          : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
