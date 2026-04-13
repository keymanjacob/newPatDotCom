// ──────────────────────────────────────────────
// Baby Tracker — Today Summary Hook
// ──────────────────────────────────────────────
// Computes "last bottle X ago" and "last nap Y ago"
// from local Dexie data (offline-first).
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { db } from "../db/dexie";
import type { TodaySummary, BabyEvent } from "@baby-tracker/shared";

function formatTimeAgo(now: Date, past: Date): string {
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins === 0) return `${hours}h ago`;
  return `${hours}.${Math.round((mins / 60) * 10)}h ago`;
}

export function useTodaySummary(events: BabyEvent[]): TodaySummary {
  const [summary, setSummary] = useState<TodaySummary>({
    lastBottleAgo: null,
    lastBottleTimestamp: null,
    lastNapAgo: null,
    lastNapTimestamp: null,
  });

  const compute = useCallback(async () => {
    const now = new Date();

    // Last feed from Dexie
    const lastFeed = await db.events
      .where("type")
      .equals("feed")
      .reverse()
      .sortBy("timestamp")
      .then((events) => events[0] || null);

    // Last sleep start from Dexie
    const allSleep = await db.events
      .where("type")
      .equals("sleep")
      .reverse()
      .sortBy("timestamp");

    const lastSleepStart = allSleep.find(
      (e) => (e.value as { action: string }).action === "start"
    );

    setSummary({
      lastBottleAgo: lastFeed
        ? formatTimeAgo(now, new Date(lastFeed.timestamp))
        : null,
      lastBottleTimestamp: lastFeed ? lastFeed.timestamp : null,
      lastNapAgo: lastSleepStart
        ? formatTimeAgo(now, new Date(lastSleepStart.timestamp))
        : null,
      lastNapTimestamp: lastSleepStart ? lastSleepStart.timestamp : null,
    });
  }, []);

  useEffect(() => {
    compute();
  }, [compute, events]);

  return summary;
}
