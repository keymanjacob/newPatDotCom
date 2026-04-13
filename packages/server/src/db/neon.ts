// ──────────────────────────────────────────────
// Baby Tracker Server — Neon Database Layer
// ──────────────────────────────────────────────

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  BabyEvent,
  SyncPayload,
  SyncResponse,
  DailySleepData,
  DailyFeedVolumeData,
  DailyDiaperData,
  TrendSummary,
  ActivityItem,
  TodaySummary,
} from "@baby-tracker/shared";

let sql: NeonQueryFunction<false, false>;

/**
 * Initialize the Neon database connection.
 * Must be called once at server startup.
 */
export function initDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
      "See .env.example for setup instructions."
    );
  }
  sql = neon(databaseUrl);
  console.log("✅ Neon database connection initialized");
}

/**
 * Create the events table if it doesn't exist.
 * Uses IF NOT EXISTS so it's safe to call on every startup.
 */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id          UUID PRIMARY KEY,
      type        VARCHAR(10) NOT NULL CHECK (type IN ('sleep', 'feed', 'diaper')),
      value       JSONB NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Index for querying recent events
  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON events (timestamp DESC)
  `;

  // Index for querying by type
  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_type
    ON events (type)
  `;

  // Composite index for trend aggregation queries (type + date range)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_type_timestamp
    ON events (type, timestamp)
  `;

  console.log("✅ Database schema ensured");
}

/**
 * Upsert a batch of events using INSERT ... ON CONFLICT.
 * "Last write wins" — if a UUID already exists, we update it.
 */
export async function upsertEvents(
  payload: SyncPayload
): Promise<SyncResponse> {
  const syncedIds: string[] = [];

  for (const event of payload.events) {
    await sql`
      INSERT INTO events (id, type, value, timestamp)
      VALUES (
        ${event.id}::uuid,
        ${event.type},
        ${JSON.stringify(event.value)}::jsonb,
        ${event.timestamp}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        type       = EXCLUDED.type,
        value      = EXCLUDED.value,
        timestamp  = EXCLUDED.timestamp,
        updated_at = NOW()
    `;
    syncedIds.push(event.id);
  }

  return {
    syncedCount: syncedIds.length,
    syncedIds,
  };
}

/**
 * Fetch recent events from the database (for future use).
 */
export async function getRecentEvents(
  limit: number = 50
): Promise<Omit<BabyEvent, "sync_status">[]> {
  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as BabyEvent["type"],
    value: row.value as BabyEvent["value"],
    timestamp: (row.timestamp as Date).toISOString(),
  }));
}

// ── Trend Aggregation Queries ───────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Get aggregated trend data for a given date range.
 * Computes sleep, feed volume, and diaper counts per day.
 */
export async function getTrendData(
  period: "week" | "month"
): Promise<TrendSummary> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(now);
  if (period === "week") {
    // Go back to the most recent Monday
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(now.getDate() - daysToMonday);
  } else {
    startDate.setDate(now.getDate() - 29); // Last 30 days
  }
  startDate.setHours(0, 0, 0, 0);

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // Fetch all events in the date range
  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    WHERE timestamp >= ${startISO}::timestamptz
      AND timestamp <= ${endISO}::timestamptz
    ORDER BY timestamp ASC
  `;

  // Build day-indexed maps
  const dayCount = period === "week" ? 7 : 30;
  const sleepMap = new Map<string, DailySleepData>();
  const feedMap = new Map<string, DailyFeedVolumeData>();
  const diaperMap = new Map<string, DailyDiaperData>();

  // Initialize all days
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
    feedMap.set(dateStr, {
      day: dayLabel,
      date: dateStr,
      totalOz: 0,
    });
    diaperMap.set(dateStr, {
      day: dayLabel,
      date: dateStr,
      wetCount: 0,
      dirtyCount: 0,
      totalCount: 0,
    });
  }

  // Track sleep start events to pair with stops
  const sleepStarts = new Map<string, Date>();

  // Process events
  for (const row of rows) {
    const ts = new Date(row.timestamp as string);
    const dateStr = ts.toISOString().split("T")[0];
    const type = row.type as string;
    const value = row.value as Record<string, unknown>;

    if (type === "feed") {
      const feedDay = feedMap.get(dateStr);
      if (feedDay && typeof value.amountOz === "number") {
        feedDay.totalOz += value.amountOz;
      }
    } else if (type === "diaper") {
      const diaperDay = diaperMap.get(dateStr);
      if (diaperDay) {
        const condition = value.condition as string;
        if (condition === "wet" || condition === "both") diaperDay.wetCount++;
        if (condition === "dirty" || condition === "both") diaperDay.dirtyCount++;
        diaperDay.totalCount++;
      }
    } else if (type === "sleep") {
      const action = value.action as string;
      if (action === "start") {
        sleepStarts.set(row.id as string, ts);
      } else if (action === "stop") {
        // Calculate duration from the stop event's value
        const durationMinutes = value.durationMinutes as number | null;
        if (durationMinutes && durationMinutes > 0) {
          const sleepDay = sleepMap.get(dateStr);
          if (sleepDay) {
            const hours = durationMinutes / 60;
            // Classify: if the corresponding start was between 7AM-7PM, it's a nap
            const startTs = value.startTimestamp
              ? new Date(value.startTimestamp as string)
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
  }

  return {
    period,
    startDate: startISO.split("T")[0],
    endDate: endISO.split("T")[0],
    sleep: Array.from(sleepMap.values()),
    feedVolume: Array.from(feedMap.values()),
    diapers: Array.from(diaperMap.values()),
  };
}

/**
 * Get today's activity timeline items, enriched with human-readable labels.
 */
export async function getTodayActivity(
  date?: string
): Promise<ActivityItem[]> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const startOfDay = `${targetDate}T00:00:00.000Z`;
  const endOfDay = `${targetDate}T23:59:59.999Z`;

  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    WHERE timestamp >= ${startOfDay}::timestamptz
      AND timestamp <= ${endOfDay}::timestamptz
    ORDER BY timestamp DESC
  `;

  return rows.map((row: Record<string, unknown>) => {
    const type = row.type as BabyEvent["type"];
    const value = row.value as Record<string, unknown>;
    let label = "";

    if (type === "feed") {
      const amount = value.amountOz as number | null;
      const method = value.method as string;
      label = amount ? `${amount}oz ${method === "bottle" ? "Formula" : "Breast"}` : "Breast Feed";
    } else if (type === "sleep") {
      const action = value.action as string;
      label = action === "start" ? "Nap Started" : "Woke Up";
    } else if (type === "diaper") {
      const condition = value.condition as string;
      const condLabel = condition.charAt(0).toUpperCase() + condition.slice(1);
      label = `Diaper · ${condLabel}`;
    }

    return {
      id: row.id as string,
      type,
      label,
      value: value as unknown as BabyEvent["value"],
      timestamp: (row.timestamp as Date).toISOString(),
    };
  });
}

/**
 * Get summary stats for the Today header pills.
 * Computes "last bottle X ago" and "last nap Y ago".
 */
export async function getTodaySummary(): Promise<TodaySummary> {
  const now = new Date();

  // Last bottle (feed event)
  const lastFeedRows = await sql`
    SELECT timestamp FROM events
    WHERE type = 'feed'
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  // Last nap (sleep start event)
  const lastSleepRows = await sql`
    SELECT timestamp FROM events
    WHERE type = 'sleep' AND value->>'action' = 'start'
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  return {
    lastBottleAgo: lastFeedRows.length > 0
      ? formatTimeAgo(now, new Date(lastFeedRows[0].timestamp as string))
      : null,
    lastBottleTimestamp: lastFeedRows.length > 0
      ? (new Date(lastFeedRows[0].timestamp as string)).toISOString()
      : null,
    lastNapAgo: lastSleepRows.length > 0
      ? formatTimeAgo(now, new Date(lastSleepRows[0].timestamp as string))
      : null,
    lastNapTimestamp: lastSleepRows.length > 0
      ? (new Date(lastSleepRows[0].timestamp as string)).toISOString()
      : null,
  };
}

/** Format a duration as "Xh ago" or "Xm ago" */
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
