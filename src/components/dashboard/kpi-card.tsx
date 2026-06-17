/**
 * KPI 卡片（制罐业务版）
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "emerald" | "amber" | "rose" | "sky" | "slate" | "orange";

const TONE_BG: Record<Tone, string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/5",
  amber: "border-amber-500/20 bg-amber-500/5",
  rose: "border-rose-500/20 bg-rose-500/5",
  sky: "border-sky-500/20 bg-sky-500/5",
  slate: "border-slate-800 bg-slate-900/60",
  orange: "border-orange-500/20 bg-orange-500/5",
};
const TONE_FG: Record<Tone, string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  sky: "text-sky-400",
  slate: "text-slate-300",
  orange: "text-orange-400",
};
const TONE_BAR: Record<Tone, string> = {
  emerald: "[&>div]:bg-emerald-500",
  amber: "[&>div]:bg-amber-500",
  rose: "[&>div]:bg-rose-500",
  sky: "[&>div]:bg-sky-500",
  slate: "[&>div]:bg-slate-400",
  orange: "[&>div]:bg-orange-500",
};

export function KpiCard({
  title,
  value,
  unit,
  target,
  trend,
  tone = "slate",
  isPercent = false,
  icon,
}: {
  title: string;
  value: number;
  unit?: string;
  target?: number;
  trend?: number;
  tone?: Tone;
  isPercent?: boolean;
  icon?: ReactNode;
}) {
  const displayValue = isPercent
    ? value.toFixed(2)
    : Math.round(value).toLocaleString();
  const pct = target && target > 0 ? (value / target) * 100 : null;
  const trendUp = trend !== undefined && trend > 0;
  const trendDown = trend !== undefined && trend < 0;

  return (
    <Card className={`border ${TONE_BG[tone]}`}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {icon && <span className={TONE_FG[tone]}>{icon}</span>}
            {title}
          </div>
          {trend !== undefined && (
            <div
              className={`flex items-center gap-0.5 font-mono text-[10px] ${
                trendUp ? "text-emerald-400" : trendDown ? "text-rose-400" : "text-slate-500"
              }`}
            >
              {trendUp ? (
                <ArrowUp className="h-3 w-3" />
              ) : trendDown ? (
                <ArrowDown className="h-3 w-3" />
              ) : null}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono text-2xl font-semibold tabular-nums ${TONE_FG[tone]}`}>
            {displayValue}
          </span>
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
        {target !== undefined && pct !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>目标 {Math.round(target).toLocaleString()}{unit ? ` ${unit}` : ""}</span>
              <span className="font-mono text-slate-400">{pct.toFixed(0)}%</span>
            </div>
            <Progress value={Math.min(pct, 100)} className={`h-1 bg-slate-800 ${TONE_BAR[tone]}`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
