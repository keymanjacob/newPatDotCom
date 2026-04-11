// ──────────────────────────────────────────────
// Baby Tracker — Dexie.js Database Schema
// ──────────────────────────────────────────────

import Dexie, { type EntityTable } from "dexie";
import type { BabyEvent } from "@baby-tracker/shared";

/**
 * Local IndexedDB database via Dexie.
 * This is the single source of truth for the UI.
 */
class BabyTrackerDB extends Dexie {
  events!: EntityTable<BabyEvent, "id">;

  constructor() {
    super("BabyTrackerDB");

    this.version(1).stores({
      // Indexed fields: id (primary key), type, timestamp, sync_status
      // The `value` field is stored but not indexed (it's JSON)
      events: "id, type, timestamp, sync_status",
    });
  }
}

/** Singleton database instance */
export const db = new BabyTrackerDB();
