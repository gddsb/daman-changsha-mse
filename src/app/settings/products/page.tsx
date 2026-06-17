"use client";

import { useCallback, useEffect, useState } from "react";
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
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product, ProductionLine } from "@/types/mes";

export default function ProductSettingsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editMap, setEditMap] = useState<Record<string, { name: string; specification: string; default_line_code: string; default_line_name: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/production-lines").then((r) => r.json()),
      ]);
      const ps: Product[] = pRes.data ?? [];
      const ls: ProductionLine[] = lRes.data ?? [];
      setProducts(ps);
      setLines(ls);
      const m: typeof editMap = {};
      for (const p of ps) {
        m[p.code] = {
          name: p.name ?? "",
          specification: p.specification ?? "",
          default_line_code: p.default_line_code ?? "",
          default_line_name: p.default_line_name ?? "",
        };
      }
      setEditMap(m);
    } catch (e) {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (code: string, key: keyof (typeof editMap)[string], value: string) => {
    setEditMap((m) => ({ ...m, [code]: { ...m[code], [key]: value } }));
  };

  const onPickLine = (code: string, lineCode: string) => {
    const line = lines.find((l) => l.code === lineCode);
    setEditMap((m) => ({
      ...m,
      [code]: {
        ...m[code],
        default_line_code: lineCode,
        default_line_name: line?.name ?? "",
      },
    }));
  };

  const isDirty = (p: Product): boolean => {
    const e = editMap[p.code];
    if (!e) return false;
    return (
      e.name !== (p.name ?? "") ||
      e.specification !== (p.specification ?? "") ||
      e.default_line_code !== (p.default_line_code ?? "")
    );
  };

  const save = async (p: Product) => {
    const e = editMap[p.code];
    if (!e) return;
    setSavingId(p.code);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: p.code,
          name: e.name,
          specification: e.specification,
          default_line_code: e.default_line_code,
          default_line_name: e.default_line_name,
        }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (json.success) {
        await load();
      } else {
        setError(json.error || `保存失败 (HTTP ${res.status})`);
      }
    } catch {
      setError("保存失败");
    } finally {
      setSavingId(null);
    }
  };

  const reset = (p: Product) => {
    setEditMap((m) => ({
      ...m,
      [p.code]: {
        name: p.name ?? "",
        specification: p.specification ?? "",
        default_line_code: p.default_line_code ?? "",
        default_line_name: p.default_line_name ?? "",
      },
    }));
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

      <div className="flex items-center justify-between">
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
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-slate-800/60 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base">产品字典 · {products.length} 个</CardTitle>
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
                    <th className="w-36 px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const e = editMap[p.code];
                    const dirty = isDirty(p);
                    return (
                      <tr
                        key={p.code}
                        className={cn(
                          "border-t border-slate-800/60 transition",
                          dirty && "bg-orange-500/[0.04]"
                        )}
                      >
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono text-xs text-slate-300">{p.code}</span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            value={e?.name ?? ""}
                            onChange={(ev) => updateField(p.code, "name", ev.target.value)}
                            className="h-8 text-sm"
                            placeholder="产品名称"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            value={e?.specification ?? ""}
                            onChange={(ev) => updateField(p.code, "specification", ev.target.value)}
                            className="h-8 text-sm"
                            placeholder="如 400g / 700g"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={e?.default_line_code ?? ""}
                            onChange={(ev) => onPickLine(p.code, ev.target.value)}
                            className="h-8 w-full rounded-sm border border-slate-700 bg-slate-900 px-2 text-sm focus:border-orange-500 focus:outline-none"
                          >
                            <option value="">— 请选择 —</option>
                            {lines.map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.name}（{l.code}）
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reset(p)}
                              disabled={!dirty || savingId === p.code}
                              className="h-7 px-2 text-xs"
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              重置
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => save(p)}
                              disabled={!dirty || savingId === p.code}
                              className="h-7 bg-orange-500 px-2 text-xs text-white hover:bg-orange-600"
                            >
                              {savingId === p.code ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="mr-1 h-3 w-3" />
                              )}
                              保存
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-xs text-slate-500">
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
    </div>
  );
}
