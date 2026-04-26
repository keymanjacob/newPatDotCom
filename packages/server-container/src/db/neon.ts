// ──────────────────────────────────────────────
// Baby Tracker — Neon Database Layer
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
  DeltaPullResponse,
} from "@baby-tracker/shared";

let sql: NeonQueryFunction<false, false>;

export function initDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required.");
  }
  sql = neon(databaseUrl);
  console.log("✅ Neon database connection initialized");
}

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

  await sql`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_type ON events (type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events (type, timestamp)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events (updated_at DESC)`;

  console.log("✅ Database schema ensured");
}

// ── Write ─────────────────────────────────────

export async function upsertEvents(payload: SyncPayload): Promise<SyncResponse> {
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

  return { syncedCount: syncedIds.length, syncedIds };
}

// ── Delta Pull ────────────────────────────────
//
// Enforces the PRD data boundary rule:
//   - Today tab needs only the last 24h of events.
//   - Clients send ?since=<lastSyncedAt> to receive only rows that changed.
//   - Without a `since` param the window defaults to the last 24 hours —
//     this covers a fresh client install or cache miss without pulling all history.
//   - Payload size stays near-constant regardless of total history depth.

export async function getDeltaEvents(
  since?: string,
  limit = 200
): Promise<DeltaPullResponse> {
  const serverTime = new Date().toISOString();

  // Default: last 24h — covers Today tab cold start without hitting all history
  const sinceDate = since
    ? new Date(since)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sinceISO = sinceDate.toISOString();

  // Use updated_at so edits/retries are visible to clients that already
  // pulled the original row but missed the update.
  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    WHERE updated_at > ${sinceISO}::timestamptz
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `;

  const events = rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as BabyEvent["type"],
    value: row.value as BabyEvent["value"],
    timestamp: (row.timestamp as Date).toISOString(),
  }));

  return { events, serverTime };
}

// ── Trends ────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getTrendData(period: "week" | "month"): Promise<TrendSummary> {
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
  const sleepMap = new Map<string, DailySleepData>();
  const feedMap = new Map<string, DailyFeedVolumeData>();
  const diaperMap = new Map<string, DailyDiaperData>();

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLabel = DAY_LABELS[d.getDay()];

    sleepMap.set(dateStr, { day: dayLabel, date: dateStr, nightSleepHours: 0, napHours: 0, totalHours: 0 });
    feedMap.set(dateStr, { day: dayLabel, date: dateStr, totalOz: 0 });
    diaperMap.set(dateStr, { day: dayLabel, date: dateStr, wetCount: 0, dirtyCount: 0, totalCount: 0 });
  }

  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    WHERE timestamp >= ${startDate.toISOString()}::timestamptz
      AND timestamp <= ${endDate.toISOString()}::timestamptz
    ORDER BY timestamp ASC
  `;

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
    } else if (type === "sleep" && value.action === "stop") {
      const durationMinutes = value.durationMinutes as number | null;
      if (durationMinutes && durationMinutes > 0) {
        const sleepDay = sleepMap.get(dateStr);
        if (sleepDay) {
          const hours = durationMinutes / 60;
          const startTs = value.startTimestamp ? new Date(value.startTimestamp as string) : null;
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

// ── Activity ──────────────────────────────────

export async function getTodayActivity(date?: string): Promise<ActivityItem[]> {
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
      label = amount
        ? `${amount}oz ${value.method === "bottle" ? "Formula" : "Breast"}`
        : "Breast Feed";
    } else if (type === "sleep") {
      label = value.action === "start" ? "Nap Started" : "Woke Up";
    } else if (type === "diaper") {
      const condition = value.condition as string;
      label = `Diaper · ${condition.charAt(0).toUpperCase() + condition.slice(1)}`;
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

export async function getTodaySummary(): Promise<TodaySummary> {
  const now = new Date();

  const lastFeedRows = await sql`
    SELECT timestamp FROM events
    WHERE type = 'feed'
    ORDER BY timestamp DESC LIMIT 1
  `;

  const lastSleepRows = await sql`
    SELECT timestamp FROM events
    WHERE type = 'sleep' AND value->>'action' = 'start'
    ORDER BY timestamp DESC LIMIT 1
  `;

  return {
    lastBottleAgo: lastFeedRows.length > 0
      ? formatTimeAgo(now, new Date(lastFeedRows[0].timestamp as string))
      : null,
    lastBottleTimestamp: lastFeedRows.length > 0
      ? new Date(lastFeedRows[0].timestamp as string).toISOString()
      : null,
    lastNapAgo: lastSleepRows.length > 0
      ? formatTimeAgo(now, new Date(lastSleepRows[0].timestamp as string))
      : null,
    lastNapTimestamp: lastSleepRows.length > 0
      ? new Date(lastSleepRows[0].timestamp as string).toISOString()
      : null,
  };
}

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
