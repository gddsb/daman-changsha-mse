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
  运行: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
  停机: "border-border bg-muted/60 text-muted-foreground",
  维保: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]",
  故障: "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]",
};

export function LineStatusCard({ lines }: { lines: LineStatusItem[] }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-2">
        <CardTitle className="text-sm font-medium text-foreground">产线状态</CardTitle>
        <Badge variant="outline" className="border-border text-muted-foreground">
          {lines.length} 条线
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {lines.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground/70">暂无产线数据</p>
        )}
        {lines.map((l) => {
          const pct = l.todayPlanned > 0 ? (l.todayActual / l.todayPlanned) * 100 : 0;
          const tone = STATUS_TONE[l.status] ?? STATUS_TONE.停机;
          return (
            <div key={l.code} className="space-y-2 rounded border border-border bg-muted/70 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="font-mono text-sm text-foreground">{l.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {l.code}
                  </span>
                </div>
                <Badge variant="outline" className={tone}>
                  {l.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground/70">在制工单</div>
                  <div className="mt-0.5 font-mono text-foreground">{l.orderCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground/70">实际/计划</div>
                  <div className="mt-0.5 font-mono text-foreground">
                    {l.todayActual.toLocaleString()} / {l.todayPlanned.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground/70">合格率</div>
                  <div
                    className={`mt-0.5 font-mono ${
                      l.todayPassRate >= 99
                        ? "text-[var(--success)]"
                        : l.todayPassRate >= 95
                          ? "text-[var(--warning)]"
                          : "text-[var(--danger)]"
                    }`}
                  >
                    {l.todayPassRate.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                  <span>计划达成</span>
                  <span className="font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  className="h-1 bg-muted [&>div]:bg-[var(--brand)]"
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
