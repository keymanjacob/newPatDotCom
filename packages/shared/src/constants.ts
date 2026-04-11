// ──────────────────────────────────────────────
// Baby Tracker — Shared Constants
// ──────────────────────────────────────────────

import type { EventType, FeedMethod, DiaperCondition } from "./types.js";

/** All supported event types */
export const EVENT_TYPES: readonly EventType[] = [
  "sleep",
  "feed",
  "diaper",
] as const;

/** Feed method options */
export const FEED_METHODS: readonly FeedMethod[] = [
  "bottle",
  "breast",
] as const;

/** Pre-defined bottle amounts in ounces */
export const BOTTLE_AMOUNTS_OZ: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8,
] as const;

/** Diaper condition options */
export const DIAPER_CONDITIONS: readonly DiaperCondition[] = [
  "wet",
  "dirty",
  "both",
] as const;

/** Sync engine config */
export const SYNC_CONFIG = {
  /** Interval between sync attempts (ms) */
  SYNC_INTERVAL_MS: 30_000,
  /** Max events per sync batch */
  BATCH_SIZE: 50,
  /** Max retry attempts before backing off */
  MAX_RETRIES: 3,
} as const;

/** API route paths */
export const API_ROUTES = {
  HEALTH: "/api/health",
  EVENTS: "/api/events",
} as const;
