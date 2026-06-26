/**
 * KPI 卡片（制罐业务版）
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "primary";

const TONE_BG: Record<Tone, string> = {
  success: "border-success/20 bg-success/5",
  warning: "border-warning/20 bg-warning/5",
  danger: "border-destructive/20 bg-destructive/5",
  info: "border-info/20 bg-info/5",
  muted: "border-border bg-muted/30",
  primary: "border-primary/20 bg-primary/5",
};
const TONE_FG: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  muted: "text-muted-foreground",
  primary: "text-primary",
};
const TONE_BAR: Record<Tone, string> = {
  success: "[&>div]:bg-success",
  warning: "[&>div]:bg-warning",
  danger: "[&>div]:bg-destructive",
  info: "[&>div]:bg-info",
  muted: "[&>div]:bg-muted-foreground",
  primary: "[&>div]:bg-primary",
};

export function KpiCard({
  title,
  value,
  unit,
  target,
  trend,
  tone = "muted",
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon && <span className={TONE_FG[tone]}>{icon}</span>}
            {title}
          </div>
          {trend !== undefined && (
            <div
              className={`flex items-center gap-0.5 font-mono text-[10px] ${
                trendUp ? "text-success" : trendDown ? "text-destructive" : "text-muted-foreground"
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
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {target !== undefined && pct !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>目标 {Math.round(target).toLocaleString()}{unit ? ` ${unit}` : ""}</span>
              <span className="font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
            </div>
            <Progress value={Math.min(pct, 100)} className={`h-1 bg-muted ${TONE_BAR[tone]}`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}