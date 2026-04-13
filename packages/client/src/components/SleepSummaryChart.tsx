// ──────────────────────────────────────────────
// Baby Tracker — Sleep Summary Chart
// ──────────────────────────────────────────────
// Horizontal stacked bar chart showing Night Sleep
// vs Naps per day — using Recharts for maintainability.
// ──────────────────────────────────────────────

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { DailySleepData } from "@baby-tracker/shared";

interface SleepSummaryChartProps {
  data: DailySleepData[];
}

const NIGHT_COLOR = "#2D2B55";
const NAP_COLOR = "#C8C6E0";

export default function SleepSummaryChart({ data }: SleepSummaryChartProps) {
  const { t } = useTranslation();
  // Reverse for horizontal layout (bottom = Mon, top = Sun in design)
  // But Recharts renders first item at top, so keep as-is
  const chartData = data.map((d) => ({
    day: d.day,
    night: Math.round(d.nightSleepHours * 10) / 10,
    nap: Math.round(d.napHours * 10) / 10,
    total: Math.round(d.totalHours * 10) / 10,
  }));

  return (
    <div className="bg-surface-card rounded-2xl border border-border-subtle p-5">
      <h3 className="text-lg font-bold text-text-primary mb-1">
        {t("sleepSummary.title")}
      </h3>
      <p className="text-xs text-text-secondary mb-5">
        {t("sleepSummary.subtitle", "Hours per day this week")}
      </p>

      <div style={{ width: "100%", height: chartData.length * 38 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            barSize={14}
            barGap={0}
            barCategoryGap="25%"
          >
            <CartesianGrid
              horizontal={false}
              vertical={false}
            />
            <XAxis
              type="number"
              hide
              domain={[0, 18]}
            />
            <YAxis
              dataKey="day"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6E6E73" }}
              width={36}
            />
            <Bar
              dataKey="night"
              stackId="sleep"
              radius={[4, 0, 0, 4]}
              isAnimationActive
              animationDuration={600}
            >
              {chartData.map((_entry, index) => (
                <Cell key={`night-${index}`} fill={NIGHT_COLOR} />
              ))}
            </Bar>
            <Bar
              dataKey="nap"
              stackId="sleep"
              radius={[0, 4, 4, 0]}
              isAnimationActive
              animationDuration={600}
            >
              {chartData.map((_entry, index) => (
                <Cell key={`nap-${index}`} fill={NAP_COLOR} />
              ))}
              <LabelList
                dataKey="total"
                position="right"
                formatter={(val) => `${val}${t("sleepSummary.hrs", "h")}`}
                style={{
                  fontSize: 11,
                  fill: "#6E6E73",
                  fontWeight: 500,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: NIGHT_COLOR }}
          />
          <span className="text-xs text-text-secondary">{t("sleepSummary.night")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: NAP_COLOR }}
          />
          <span className="text-xs text-text-secondary">{t("sleepSummary.naps")}</span>
        </div>
      </div>
    </div>
  );
}
