// ──────────────────────────────────────────────
// Baby Tracker — Today Activity Hook
// ──────────────────────────────────────────────
// Enriches raw events into display-ready timeline items.
// Reads from local Dexie (offline-first).
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { db } from "../db/dexie";
import type {
  ActivityItem,
  BabyEvent,
  FeedValue,
  SleepValue,
  DiaperValue,
} from "@baby-tracker/shared";
import { useTranslation } from "react-i18next";

function enrichEvent(event: BabyEvent, t: (key: string) => string): ActivityItem {
  let label = "";

  if (event.type === "feed") {
    const val = event.value as FeedValue;
    label = val.amountOz
      ? `${val.amountOz}${t("quickActions.oz")} ${val.method === "bottle" ? t("timeline.formula") : t("timeline.breastFeed")}`
      : t("timeline.breastFeed");
  } else if (event.type === "sleep") {
    const val = event.value as SleepValue;
    label = val.action === "start" ? t("timeline.napStarted") : t("timeline.wokeUp");
  } else if (event.type === "diaper") {
    const val = event.value as DiaperValue;
    const condLabel = val.condition === "wet" ? t("quickActions.wet") : t("quickActions.dirty");
    label = `${t("timeline.diaper")} · ${condLabel}`;
  }

  return {
    id: event.id,
    type: event.type,
    label,
    timestamp: event.timestamp,
  };
}

export function useTodayActivity(events: BabyEvent[]): {
  activities: ActivityItem[];
  isLoading: boolean;
} {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const todayEvents = await db.events
      .where("timestamp")
      .aboveOrEqual(startOfDay.toISOString())
      .reverse()
      .sortBy("timestamp");

    setActivities(todayEvents.map(e => enrichEvent(e, t)));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, events, t]);

  return { activities, isLoading };
}
