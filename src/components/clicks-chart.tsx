'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';

import { formatNumber, formatShortDate } from '@/lib/format';
import type { ClickDataPoint } from '@/types';

type ClicksChartProps = {
  data: ClickDataPoint[];
};

/**
 * A single series, so there is no legend and no categorical palette to balance —
 * the heading names the measure. The mark is drawn in `--foreground` rather than
 * the theme's `--chart-*` tokens: those are defined identically in light and
 * dark (a light grey), which all but disappears on a white surface. `--foreground`
 * is defined per theme, so the line keeps strong contrast in both.
 */
const SERIES_COLOR = 'var(--foreground)';

function ClicksTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  const rawValue = payload[0]?.value;
  const clicks = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);

  return (
    <div className="border-border bg-popover text-popover-foreground rounded-md border px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground text-xs">{formatShortDate(String(label))}</p>
      <p className="font-medium tabular-nums">
        {formatNumber(clicks)} {clicks === 1 ? 'click' : 'clicks'}
      </p>
    </div>
  );
}

export function ClicksChart({ data }: ClicksChartProps) {
  const total = data.reduce((sum, point) => sum + point.clicks, 0);

  if (total === 0) {
    return (
      <div className="text-muted-foreground flex h-[260px] flex-col items-center justify-center gap-1 text-center text-sm">
        <p className="text-foreground font-medium">No clicks in the last 30 days</p>
        <p>Share the short link and visits will appear here within seconds.</p>
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive grid: horizontal only, so it reads as a reference and
              never competes with the data. */}
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />

          <YAxis
            allowDecimals={false}
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />

          <Tooltip
            content={ClicksTooltip}
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          />

          <Area
            type="monotone"
            dataKey="clicks"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill="url(#clicksFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--background)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
