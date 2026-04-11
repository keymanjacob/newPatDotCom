// ──────────────────────────────────────────────
// Baby Tracker — Shared Types
// ──────────────────────────────────────────────

/** Sync status of a locally-stored event */
export type SyncStatus = "pending" | "synced";

/** The three event categories */
export type EventType = "sleep" | "feed" | "diaper";

// ── Value Types ──────────────────────────────

export type FeedMethod = "bottle" | "breast";

export interface FeedValue {
  method: FeedMethod;
  /** Amount in ounces (e.g. 2, 4, 6, 8). Null for breast feeds with unknown amount. */
  amountOz: number | null;
}

export type SleepAction = "start" | "stop";

export interface SleepValue {
  action: SleepAction;
  /** Duration in minutes — populated when action is "stop" */
  durationMinutes: number | null;
  /** ISO timestamp of the corresponding "start" event, set on "stop" events */
  startTimestamp: string | null;
}

export type DiaperCondition = "wet" | "dirty" | "both";

export interface DiaperValue {
  condition: DiaperCondition;
}

/** Union of all possible event values */
export type EventValue = FeedValue | SleepValue | DiaperValue;

// ── Core Event ───────────────────────────────

export interface BabyEvent {
  /** UUID v4 — generated client-side */
  id: string;
  /** Category of the event */
  type: EventType;
  /** Type-specific payload */
  value: EventValue;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
  /** Local sync status — not sent to server */
  sync_status: SyncStatus;
}

// ── API Contracts ────────────────────────────

/** Payload sent from client → server (batch of events) */
export interface SyncPayload {
  events: Omit<BabyEvent, "sync_status">[];
}

/** Standard API response envelope */
export interface ApiResponse<T = null> {
  success: boolean;
  data: T;
  error: string | null;
}

/** Response from the sync endpoint */
export interface SyncResponse {
  /** Number of events successfully upserted */
  syncedCount: number;
  /** IDs of events that were processed */
  syncedIds: string[];
}

/** Health check response */
export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  version: string;
}

// ── Baby Profile Configuration ──────────────

export interface BabyProfile {
  name: string;
  /** ISO date string (YYYY-MM-DD) */
  birthDate: string;
  /** Avatar identifier or URL — for future use */
  avatar?: string;
}

// ── Trend Data Types ────────────────────────

/** Sleep data for a single day — stored in arrays for full time-series */
export interface DailySleepData {
  /** Day label e.g. "Mon", "Tue" */
  day: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Hours of night sleep (typically 7PM–7AM) */
  nightSleepHours: number;
  /** Hours of nap sleep (typically 7AM–7PM) */
  napHours: number;
  /** Total sleep hours for the day */
  totalHours: number;
}

/** Feed volume data for a single day */
export interface DailyFeedVolumeData {
  /** Day label e.g. "Mon", "Tue" */
  day: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Total formula/bottle volume in ounces */
  totalOz: number;
}

/** Diaper count data for a single day */
export interface DailyDiaperData {
  day: string;
  date: string;
  wetCount: number;
  dirtyCount: number;
  totalCount: number;
}

/**
 * Trend summary for a time period.
 * All data arrays contain one entry per day, ordered chronologically.
 * As time progresses, historical data accumulates — the API supports
 * arbitrary date ranges so the client can request week/month/custom.
 */
export interface TrendSummary {
  period: "week" | "month";
  startDate: string;
  endDate: string;
  /** Daily sleep breakdown — array length matches number of days in period */
  sleep: DailySleepData[];
  /** Daily feed volume — array length matches number of days in period */
  feedVolume: DailyFeedVolumeData[];
  /** Daily diaper counts — array length matches number of days in period */
  diapers: DailyDiaperData[];
}

// ── Activity Timeline Types ─────────────────

/** Enriched activity item for the Today timeline display */
export interface ActivityItem {
  id: string;
  type: EventType;
  /** Human-readable label e.g. "Nap Started", "4oz Formula", "Diaper · Wet" */
  label: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Summary stats displayed in the Today header pills */
export interface TodaySummary {
  /** e.g. "2.5h ago" or null if no bottle today */
  lastBottleAgo: string | null;
  /** e.g. "45m ago" or null if no nap today */
  lastNapAgo: string | null;
}
