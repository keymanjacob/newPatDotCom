// ──────────────────────────────────────────────
// Baby Tracker — Trends Screen
// ──────────────────────────────────────────────
// Matches the "Trends" Pencil design: period toggle,
// sleep summary chart, and daily volume chart.
// All data-driven via the useTrends hook.
// ──────────────────────────────────────────────

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTrends } from "../hooks/useTrends";
import SleepSummaryChart from "./SleepSummaryChart";
import DailyVolumeChart from "./DailyVolumeChart";
import LanguageToggle from "./LanguageToggle";

export default function TrendsScreen() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data, isLoading, error } = useTrends(period);

  return (
    <div className="flex-1 w-full overflow-y-auto hide-scrollbar pb-4">
      {/* Header with period toggle */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          {t("bottomNav.trends")}
        </h1>

        <div className="flex items-center gap-2">
          <LanguageToggle />

          {/* Period Toggle */}
          <div className="flex bg-surface-muted rounded-xl p-1">
            <button
              onClick={() => setPeriod("week")}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${
                  period === "week"
                    ? "bg-surface-card text-text-primary shadow-sm"
                    : "text-text-secondary"
                }
              `}
            >
              {t("trends.last7Days")}
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${
                  period === "month"
                    ? "bg-surface-card text-text-primary shadow-sm"
                    : "text-text-secondary"
                }
              `}
            >
              {t("trends.thisMonth")}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-accent-navy border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-accent-red/10 text-accent-red rounded-2xl p-4 text-sm text-center">
            {error}
          </div>
        )}

        {data && !isLoading && (
          <>
            <SleepSummaryChart data={data.sleep} />
            <DailyVolumeChart data={data.feedVolume} />
          </>
        )}
      </div>
    </div>
  );
}
