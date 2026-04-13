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

// Build a static English fallback label. ActivityTimeline.getLocalizedLabel()
// uses item.value for live translation — this label is only shown if value is absent.
function enrichEvent(event: BabyEvent): ActivityItem {
  let label = event.type;

  if (event.type === "feed") {
    const val = event.value as FeedValue;
    label = val.amountOz
      ? `${val.amountOz}oz ${val.method === "bottle" ? "Formula" : "Breast Feed"}`
      : "Breast Feed";
  } else if (event.type === "sleep") {
    const val = event.value as SleepValue;
    label = val.action === "start" ? "Nap Started" : "Woke Up";
  } else if (event.type === "diaper") {
    const val = event.value as DiaperValue;
    label = `Diaper · ${val.condition}`;
  }

  return {
    id: event.id,
    type: event.type,
    label,
    value: event.value,
    timestamp: event.timestamp,
  };
}

export function useTodayActivity(events: BabyEvent[]): {
  activities: ActivityItem[];
  isLoading: boolean;
} {
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

    setActivities(todayEvents.map(e => enrichEvent(e)));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, events]);

  return { activities, isLoading };
}
