// ──────────────────────────────────────────────
// Baby Tracker — API Client
// ──────────────────────────────────────────────

import type {
  ApiResponse,
  TrendSummary,
  ActivityItem,
  TodaySummary,
} from "@baby-tracker/shared";
import { API_ROUTES } from "@baby-tracker/shared";

/**
 * Fetch aggregated trend data for the specified period.
 */
export async function fetchTrends(
  period: "week" | "month"
): Promise<TrendSummary> {
  const res = await fetch(`${API_ROUTES.TRENDS}?period=${period}`);
  if (!res.ok) throw new Error(`Trends fetch failed: ${res.status}`);
  const json: ApiResponse<TrendSummary> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Unknown error");
  return json.data;
}

/**
 * Fetch today's activity timeline and summary stats.
 */
export async function fetchActivity(
  date?: string
): Promise<{ activities: ActivityItem[]; summary: TodaySummary }> {
  const params = date ? `?date=${date}` : "";
  const res = await fetch(`${API_ROUTES.ACTIVITY}${params}`);
  if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
  const json: ApiResponse<{ activities: ActivityItem[]; summary: TodaySummary }> =
    await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Unknown error");
  return json.data;
}
