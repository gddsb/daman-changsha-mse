"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Save,
  Loader2,
  Settings,
  Package,
  Plus,
  Upload,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product, ProductionLine } from "@/types/mes";

type EditDraft = {
  name: string;
  specification: string;
  default_line_code: string;
  default_line_name: string;
};

export default function ProductSettingsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 双击单行修改弹窗
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  // 新增弹窗
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<EditDraft>({
    name: "",
    specification: "",
    default_line_code: "",
    default_line_name: "",
  });
  const [createCode, setCreateCode] = useState("");

  // 导入弹窗
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ code: string; name: string; specification: string; default_line_code: string }>>([]);
  const [importResult, setImportResult] = useState<null | { total: number; inserted: number; skippedDuplicates: number; errors: { row: number; reason: string; code?: string }[] }>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/production-lines").then((r) => r.json()),
      ]);
      setProducts(pRes.data ?? []);
      setLines(lRes.data ?? []);
    } catch {
      setError("加载产品失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const onPickLine = (lineCode: string, target: "create" | "draft") => {
    const line = lines.find((l) => l.code === lineCode);
    if (target === "create") {
      setCreateDraft((d) => ({ ...d, default_line_code: lineCode, default_line_name: line?.name ?? "" }));
    } else {
      setDraft((d) => (d ? { ...d, default_line_code: lineCode, default_line_name: line?.name ?? "" } : d));
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setDraft({
      name: p.name ?? "",
      specification: p.specification ?? "",
      default_line_code: p.default_line_code ?? "",
      default_line_name: p.default_line_name ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing || !draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: draft.name,
          specification: draft.specification,
          default_line_code: draft.default_line_code,
          default_line_name: draft.default_line_name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setToast({ kind: "ok", text: `产品「${editing.code}」已更新` });
        setEditing(null);
        setDraft(null);
        await load();
      } else {
        setError(json.error || `保存失败 (HTTP ${res.status})`);
      }
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!createCode.trim() || !createDraft.name.trim()) {
      setError("料号和产品名称为必填");
      return;
    }
    if (!createDraft.default_line_code) {
      setError("请选择默认产线");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createCode.trim(),
          name: createDraft.name.trim(),
          specification: createDraft.specification,
          default_line_code: createDraft.default_line_code,
          default_line_name: createDraft.default_line_name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setToast({ kind: "ok", text: `已新增产品「${createCode.trim()}」` });
        setCreating(false);
        setCreateCode("");
        setCreateDraft({ name: "", specification: "", default_line_code: "", default_line_name: "" });
        await load();
      } else {
        setError(json.error || "新增失败");
      }
    } catch {
      setError("新增失败");
    } finally {
      setSaving(false);
    }
  };

  const onImportFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const cleaned = text.replace(/^﻿/, "");
      const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        setError("文件为空");
        return;
      }
      // 简单 CSV 解析：表头识别
      const header = lines[0].split(",").map((s) => s.trim());
      const codeIdx = header.indexOf("料号");
      const nameIdx = header.indexOf("产品名称");
      const specIdx = header.indexOf("规格");
      const lineIdx = header.indexOf("默认产线");
      if (codeIdx < 0 || nameIdx < 0) {
        setError("缺少必填列：料号 / 产品名称");
        return;
      }
      const dataRows = lines.slice(1).map((line) => line.split(",").map((s) => s.trim()));
      const rows = dataRows
        .filter((r) => r.some((c) => c.length > 0))
        .map((r) => ({
          code: r[codeIdx] ?? "",
          name: r[nameIdx] ?? "",
          specification: specIdx >= 0 ? r[specIdx] ?? "" : "",
          default_line_code: lineIdx >= 0 ? r[lineIdx] ?? "" : "",
        }));
      setImportRows(rows);
    } catch (e) {
      setError(`解析文件失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const submitImport = async () => {
    if (importRows.length === 0) {
      setError("没有可导入的行");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import", rows: importRows }),
      });
      const json = await res.json();
      if (json.success) {
        setImportResult(json.data);
        await load();
      } else {
        setError(json.error || "导入失败");
      }
    } catch {
      setError("导入失败");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.specification ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Settings className="h-3 w-3" />
        <span>参数设置</span>
        <span>/</span>
        <span className="text-foreground">产品信息</span>
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">产品信息</h1>
          <p className="text-xs text-muted-foreground">
            维护产品字典：料号、名称、规格、默认产线。新增工单时自动带入。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索料号 / 名称 / 规格"
              className="h-8 w-72 pl-7 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => (window.location.href = "/api/products/template")}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            下载导入模板
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setImporting(true);
              setImportResult(null);
              setImportRows([]);
            }}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            导入产品
          </Button>
          <Button
            size="sm"
            className="h-8 bg-orange-500 text-xs text-white hover:bg-orange-600"
            onClick={() => {
              setCreating(true);
              setCreateCode("");
              setCreateDraft({ name: "", specification: "", default_line_code: "", default_line_name: "" });
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增产品
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-rose-400 hover:text-rose-300">
            ×
          </button>
        </div>
      )}
      {toast && (
        <div
          className={cn(
            "rounded-sm border px-3 py-2 text-xs",
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          )}
        >
          {toast.text}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-slate-800/60 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base">产品字典 · {products.length} 个</CardTitle>
            <span className="ml-auto text-[10px] text-slate-500">双击单行进入修改</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/40 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="w-44 px-3 py-2 text-left">料号</th>
                    <th className="min-w-[200px] px-3 py-2 text-left">产品名称</th>
                    <th className="w-40 px-3 py-2 text-left">规格</th>
                    <th className="w-44 px-3 py-2 text-left">默认产线</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.code}
                      onDoubleClick={() => openEdit(p)}
                      className="cursor-pointer border-t border-slate-800/60 transition-colors hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2 align-top">
                        <span className="font-mono text-xs text-slate-300">{p.code}</span>
                      </td>
                      <td className="px-3 py-2 align-top text-sm text-slate-100">{p.name}</td>
                      <td className="px-3 py-2 align-top text-sm text-slate-300">
                        {p.specification || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-sm">
                        {p.default_line_name ? (
                          <span className="font-mono text-xs text-amber-300">{p.default_line_name}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-12 text-center text-xs text-slate-500">
                        没有匹配的产品
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* === 单行修改弹窗 === */}
      {editing && draft && (
        <ModalShell title={`修改产品 · ${editing.code}`} onClose={() => setEditing(null)}>
          <Field label="料号">
            <Input value={editing.code} disabled className="h-8 text-sm" />
          </Field>
          <Field label="产品名称 *">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-8 text-sm"
              placeholder="产品名称"
            />
          </Field>
          <Field label="规格">
            <Input
              value={draft.specification}
              onChange={(e) => setDraft({ ...draft, specification: e.target.value })}
              className="h-8 text-sm"
              placeholder="如 400g / 700g"
            />
          </Field>
          <Field label="默认产线 *">
            <select
              value={draft.default_line_code}
              onChange={(e) => onPickLine(e.target.value, "draft")}
              className="h-8 w-full rounded-sm border border-slate-700 bg-slate-900 px-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              <option value="">— 请选择 —</option>
              {lines.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}（{l.code}）
                </option>
              ))}
            </select>
          </Field>
          <ModalActions
            onCancel={() => setEditing(null)}
            onConfirm={saveEdit}
            confirmDisabled={saving || !draft.name.trim() || !draft.default_line_code}
            confirmText="保存"
          />
        </ModalShell>
      )}

      {/* === 新增产品弹窗 === */}
      {creating && (
        <ModalShell title="新增产品" onClose={() => setCreating(false)}>
          <Field label="料号 *">
            <Input
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value)}
              className="h-8 text-sm"
              placeholder="如 P-200-001"
            />
          </Field>
          <Field label="产品名称 *">
            <Input
              value={createDraft.name}
              onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
              className="h-8 text-sm"
              placeholder="产品名称"
            />
          </Field>
          <Field label="规格">
            <Input
              value={createDraft.specification}
              onChange={(e) => setCreateDraft({ ...createDraft, specification: e.target.value })}
              className="h-8 text-sm"
              placeholder="如 400g / 700g"
            />
          </Field>
          <Field label="默认产线 *">
            <select
              value={createDraft.default_line_code}
              onChange={(e) => onPickLine(e.target.value, "create")}
              className="h-8 w-full rounded-sm border border-slate-700 bg-slate-900 px-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              <option value="">— 请选择 —</option>
              {lines.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}（{l.code}）
                </option>
              ))}
            </select>
          </Field>
          <ModalActions
            onCancel={() => setCreating(false)}
            onConfirm={submitCreate}
            confirmDisabled={saving || !createCode.trim() || !createDraft.name.trim() || !createDraft.default_line_code}
            confirmText="新增"
          />
        </ModalShell>
      )}

      {/* === 导入产品弹窗 === */}
      {importing && (
        <ModalShell
          title="导入产品"
          onClose={() => setImporting(false)}
          wide
        >
          {!importResult ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2 rounded-sm border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                <div>
                  请按模板格式上传 CSV 文件。导入规则：
                  <ul className="ml-4 mt-1 list-disc text-[11px] text-slate-500">
                    <li>料号字段为唯一内容，导入前自动去重（行内 + DB 已有）</li>
                    <li>默认产线只能为 A 线 或 B 线</li>
                    <li>产品名称为必填</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => (window.location.href = "/api/products/template")}
                >
                  <Download className="mr-1 h-3 w-3" />
                  下载模板
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                }}
                className="block w-full cursor-pointer rounded-sm border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 file:mr-3 file:rounded-sm file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-xs file:text-slate-100 hover:border-orange-500"
              />
              {importRows.length > 0 && (
                <div className="mt-3 max-h-64 overflow-auto rounded-sm border border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/40 text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-2 py-1 text-left">料号</th>
                        <th className="px-2 py-1 text-left">产品名称</th>
                        <th className="px-2 py-1 text-left">规格</th>
                        <th className="px-2 py-1 text-left">默认产线</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, i) => (
                        <tr key={i} className="border-t border-slate-800/60">
                          <td className="px-2 py-1 font-mono text-slate-300">{r.code}</td>
                          <td className="px-2 py-1 text-slate-200">{r.name}</td>
                          <td className="px-2 py-1 text-slate-400">{r.specification || "—"}</td>
                          <td className="px-2 py-1 font-mono text-amber-300">{r.default_line_code || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ModalActions
                onCancel={() => setImporting(false)}
                onConfirm={submitImport}
                confirmDisabled={saving || importRows.length === 0}
                confirmText={`导入 ${importRows.length} 行`}
              />
            </>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                导入完成：共 {importResult.total} 行，成功 {importResult.inserted}，
                跳过重复 {importResult.skippedDuplicates}
                {importResult.errors.length > 0 && `，错误 ${importResult.errors.length}`}
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
                  {importResult.errors.map((e, i) => (
                    <div key={i}>
                      第 {e.row} 行{e.code ? `（${e.code}）` : ""}：{e.reason}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-7 bg-orange-500 text-xs text-white hover:bg-orange-600"
                  onClick={() => setImporting(false)}
                >
                  关闭
                </Button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full rounded-sm border border-slate-800 bg-slate-950 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-md"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmDisabled,
  confirmText,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmText: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
        取消
      </Button>
      <Button
        size="sm"
        className="h-7 bg-orange-500 px-3 text-xs text-white hover:bg-orange-600"
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        {confirmText}
      </Button>
    </div>
  );
}
