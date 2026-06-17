/**
 * 产线状态卡（A/B 线产量、达成率、合格率）
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity } from "lucide-react";
import type { LineStatusItem } from "@/types/mes";

const STATUS_TONE: Record<string, string> = {
  运行: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  停机: "border-slate-700 bg-slate-800/40 text-slate-400",
  维保: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  故障: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

export function LineStatusCard({ lines }: { lines: LineStatusItem[] }) {
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-2">
        <CardTitle className="text-sm font-medium text-slate-200">产线状态</CardTitle>
        <Badge variant="outline" className="border-slate-700 text-slate-400">
          {lines.length} 条线
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {lines.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">暂无产线数据</p>
        )}
        {lines.map((l) => {
          const pct = l.todayPlanned > 0 ? (l.todayActual / l.todayPlanned) * 100 : 0;
          const tone = STATUS_TONE[l.status] ?? STATUS_TONE.停机;
          return (
            <div key={l.code} className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-mono text-sm text-slate-200">{l.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {l.code}
                  </span>
                </div>
                <Badge variant="outline" className={tone}>
                  {l.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-slate-500">在制工单</div>
                  <div className="mt-0.5 font-mono text-slate-200">{l.orderCount}</div>
                </div>
                <div>
                  <div className="text-slate-500">实际/计划</div>
                  <div className="mt-0.5 font-mono text-slate-200">
                    {l.todayActual.toLocaleString()} / {l.todayPlanned.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">合格率</div>
                  <div
                    className={`mt-0.5 font-mono ${
                      l.todayPassRate >= 99
                        ? "text-emerald-400"
                        : l.todayPassRate >= 95
                          ? "text-amber-400"
                          : "text-rose-400"
                    }`}
                  >
                    {l.todayPassRate.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>计划达成</span>
                  <span className="font-mono text-slate-400">{pct.toFixed(0)}%</span>
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  className="h-1 bg-slate-800 [&>div]:bg-orange-500"
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
