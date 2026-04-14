// ──────────────────────────────────────────────
// Baby Tracker — API Client
// ──────────────────────────────────────────────
// All fetch logic lives here so both eventStore and
// syncEngine can call it without a circular dependency.
// ──────────────────────────────────────────────

import type {
  ApiResponse,
  TrendSummary,
  ActivityItem,
  TodaySummary,
  BabyEvent,
  SyncPayload,
  SyncResponse,
} from "@baby-tracker/shared";
import { API_ROUTES } from "@baby-tracker/shared";

// ── Trends ───────────────────────────────────

export async function fetchTrends(
  period: "week" | "month"
): Promise<TrendSummary> {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${baseUrl}${API_ROUTES.TRENDS}?period=${period}`);
  if (!res.ok) throw new Error(`Trends fetch failed: ${res.status}`);
  const json: ApiResponse<TrendSummary> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Unknown error");
  return json.data;
}

// ── Activity ─────────────────────────────────

export async function fetchActivity(
  date?: string
): Promise<{ activities: ActivityItem[]; summary: TodaySummary }> {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const params = date ? `?date=${date}` : "";
  const res = await fetch(`${baseUrl}${API_ROUTES.ACTIVITY}${params}`);
  if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
  const json: ApiResponse<{ activities: ActivityItem[]; summary: TodaySummary }> =
    await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Unknown error");
  return json.data;
}

// ── Events: Push ─────────────────────────────

/**
 * POST a batch of events to the server.
 * Returns the sync result, or null on any failure (caller should not throw —
 * the 30s sweep will retry pending events automatically).
 */
export async function pushEvents(
  events: BabyEvent[]
): Promise<SyncResponse | null> {
  if (!navigator.onLine) return null;
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const payload: SyncPayload = {
    events: events.map(({ sync_status: _, ...e }) => e),
  };
  const res = await fetch(`${baseUrl}${API_ROUTES.EVENTS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const json: ApiResponse<SyncResponse> = await res.json();
  return json.success && json.data ? json.data : null;
}

// ── Events: Pull ─────────────────────────────

/**
 * GET all recent events from the server.
 * Returns the raw server array (without sync_status), or null on failure.
 * Callers must stamp sync_status: "synced" before writing to Dexie.
 */
export async function pullEvents(): Promise<Omit<BabyEvent, "sync_status">[] | null> {
  if (!navigator.onLine) return null;
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${baseUrl}${API_ROUTES.EVENTS}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const json: ApiResponse<Omit<BabyEvent, "sync_status">[]> = await res.json();
  return json.success && json.data ? json.data : null;
}
