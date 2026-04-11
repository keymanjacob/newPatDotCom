// ──────────────────────────────────────────────
// Baby Tracker — Trends Hook
// ──────────────────────────────────────────────
// Fetches trend data — tries the API first, falls back
// to local Dexie aggregation when offline.
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { db } from "../db/dexie";
import { fetchTrends } from "../api";
import type {
  TrendSummary,
  DailySleepData,
  DailyFeedVolumeData,
  DailyDiaperData,
  FeedValue,
  SleepValue,
  DiaperValue,
} from "@baby-tracker/shared";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Compute trend data locally from Dexie (offline fallback).
 */
async function computeLocalTrends(
  period: "week" | "month"
): Promise<TrendSummary> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(now);
  if (period === "week") {
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(now.getDate() - daysToMonday);
  } else {
    startDate.setDate(now.getDate() - 29);
  }
  startDate.setHours(0, 0, 0, 0);

  const dayCount = period === "week" ? 7 : 30;

  // Initialize day maps
  const sleepMap = new Map<string, DailySleepData>();
  const feedMap = new Map<string, DailyFeedVolumeData>();
  const diaperMap = new Map<string, DailyDiaperData>();

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLabel = DAY_LABELS[d.getDay()];

    sleepMap.set(dateStr, {
      day: dayLabel,
      date: dateStr,
      nightSleepHours: 0,
      napHours: 0,
      totalHours: 0,
    });
    feedMap.set(dateStr, { day: dayLabel, date: dateStr, totalOz: 0 });
    diaperMap.set(dateStr, {
      day: dayLabel,
      date: dateStr,
      wetCount: 0,
      dirtyCount: 0,
      totalCount: 0,
    });
  }

  // Query events in range from Dexie
  const events = await db.events
    .where("timestamp")
    .between(startDate.toISOString(), endDate.toISOString(), true, true)
    .toArray();

  for (const event of events) {
    const ts = new Date(event.timestamp);
    const dateStr = ts.toISOString().split("T")[0];

    if (event.type === "feed") {
      const feedDay = feedMap.get(dateStr);
      const val = event.value as FeedValue;
      if (feedDay && typeof val.amountOz === "number") {
        feedDay.totalOz += val.amountOz;
      }
    } else if (event.type === "diaper") {
      const diaperDay = diaperMap.get(dateStr);
      const val = event.value as DiaperValue;
      if (diaperDay) {
        if (val.condition === "wet" || val.condition === "both") diaperDay.wetCount++;
        if (val.condition === "dirty" || val.condition === "both") diaperDay.dirtyCount++;
        diaperDay.totalCount++;
      }
    } else if (event.type === "sleep") {
      const val = event.value as SleepValue;
      if (val.action === "stop" && val.durationMinutes) {
        const sleepDay = sleepMap.get(dateStr);
        if (sleepDay) {
          const hours = val.durationMinutes / 60;
          const startTs = val.startTimestamp
            ? new Date(val.startTimestamp)
            : null;
          const startHour = startTs ? startTs.getHours() : ts.getHours();
          if (startHour >= 7 && startHour < 19) {
            sleepDay.napHours += hours;
          } else {
            sleepDay.nightSleepHours += hours;
          }
          sleepDay.totalHours = sleepDay.nightSleepHours + sleepDay.napHours;
        }
      }
    }
  }

  return {
    period,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    sleep: Array.from(sleepMap.values()),
    feedVolume: Array.from(feedMap.values()),
    diapers: Array.from(diaperMap.values()),
  };
}

export function useTrends(period: "week" | "month"): {
  data: TrendSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<TrendSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try API first (if online)
      if (navigator.onLine) {
        const apiData = await fetchTrends(period);
        setData(apiData);
        setIsLoading(false);
        return;
      }
    } catch {
      // API failed — fall through to local
      console.warn("⚠️ Trends API unavailable, using local data");
    }

    // Fallback: compute from local Dexie
    try {
      const localData = await computeLocalTrends(period);
      setData(localData);
    } catch (err) {
      setError("Failed to load trend data");
      console.error("❌ Local trends computation failed:", err);
    }

    setIsLoading(false);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}
