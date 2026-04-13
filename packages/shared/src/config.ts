// ──────────────────────────────────────────────
// Baby Tracker — Baby Profile Configuration
// ──────────────────────────────────────────────
// MVP: single baby, read from this config file.
// Future: multi-baby support via DB + user accounts.
// ──────────────────────────────────────────────

import type { BabyProfile } from "./types.js";

/**
 * Active baby profile.
 * Update this configuration to change the displayed baby.
 * In a future version, this will be fetched from the database
 * and support multiple babies per household.
 */
export const BABY_PROFILE: BabyProfile = {
  name: "Charlie F",
  birthDate: "2026-01-15",
};
