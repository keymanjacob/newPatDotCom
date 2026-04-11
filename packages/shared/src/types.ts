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
