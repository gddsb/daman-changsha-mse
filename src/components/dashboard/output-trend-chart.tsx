'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import type { OutputTrendPoint } from '@/types/mes';

export function OutputTrendChart({ data }: { data: OutputTrendPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="plannedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2738" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#6b7592"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1f2738' }}
          />
          <YAxis
            stroke="#6b7592"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: '#0b0f1a',
              border: '1px solid #1f2738',
              borderRadius: 2,
              fontSize: 12,
              color: '#e8ecf4',
            }}
            labelStyle={{ color: '#a0aabe' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#a0aabe', paddingTop: 8 }}
            iconType="square"
            iconSize={8}
          />
          <Area
            type="monotone"
            dataKey="planned"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="url(#plannedFill)"
            name="计划"
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#actualFill)"
            name="实绩"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
