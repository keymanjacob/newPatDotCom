// ──────────────────────────────────────────────
// Baby Tracker — Daily Volume Chart
// ──────────────────────────────────────────────
// Vertical bar chart for formula intake (oz) per day
// using Recharts for maintainability.
// ──────────────────────────────────────────────

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { DailyFeedVolumeData } from "@baby-tracker/shared";

interface DailyVolumeChartProps {
  data: DailyFeedVolumeData[];
}

const BAR_COLORS = [
  "#9B99C7", // Mon - lighter purple
  "#8886B8", // Tue
  "#7B78AA", // Wed
  "#2D2B55", // Thu - highlight (darkest)
  "#7B78AA", // Fri
  "#9B99C7", // Sat
  "#8886B8", // Sun
];

export default function DailyVolumeChart({ data }: DailyVolumeChartProps) {
  const chartData = data.map((d, i) => ({
    day: d.day,
    oz: Math.round(d.totalOz * 10) / 10,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }));

  const maxOz = Math.max(...chartData.map((d) => d.oz), 1);

  return (
    <div className="bg-surface-card rounded-2xl border border-border-subtle p-5">
      <h3 className="text-lg font-bold text-text-primary mb-1">
        Daily Volume
      </h3>
      <p className="text-xs text-text-secondary mb-5">
        Formula intake (oz) this week
      </p>

      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 8, left: 8, bottom: 0 }}
            barSize={32}
            barCategoryGap="20%"
          >
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6E6E73" }}
            />
            <YAxis
              hide
              domain={[0, maxOz * 1.2]}
            />
            <Bar
              dataKey="oz"
              radius={[6, 6, 0, 0]}
              isAnimationActive
              animationDuration={600}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="oz"
                position="top"
                style={{
                  fontSize: 11,
                  fill: "#1D1D1F",
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
