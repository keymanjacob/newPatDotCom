// ──────────────────────────────────────────────
// Baby Tracker — Background Sync Engine
// ──────────────────────────────────────────────
// Runs in the background, pushing pending events
// from Dexie to the server API.
// ──────────────────────────────────────────────

import { db } from "../db/dexie";
import { useEventStore } from "./eventStore";
import {
  SYNC_CONFIG,
  API_ROUTES,
  type SyncPayload,
  type ApiResponse,
  type SyncResponse,
} from "@baby-tracker/shared";

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/**
 * Attempt to sync all pending events to the server.
 * Called automatically on interval and on `online` events.
 */
async function syncPendingEvents(): Promise<void> {
  // Prevent concurrent syncs
  if (isSyncing) return;

  // Don't sync if offline
  if (!navigator.onLine) return;

  isSyncing = true;

  try {
    // Query Dexie for pending events
    const pendingEvents = await db.events
      .where("sync_status")
      .equals("pending")
      .limit(SYNC_CONFIG.BATCH_SIZE)
      .toArray();

    if (pendingEvents.length === 0) {
      return;
    }

    console.log(`🔄 Syncing ${pendingEvents.length} event(s)...`);

    // Build payload (strip sync_status for server)
    const payload: SyncPayload = {
      events: pendingEvents.map(({ sync_status: _, ...event }) => event),
    };

    // Push to server
    const response = await fetch(API_ROUTES.EVENTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`⚠️ Sync failed with status ${response.status}`);
      return;
    }

    const result: ApiResponse<SyncResponse> = await response.json();

    if (result.success && result.data) {
      console.log(`✅ Synced ${result.data.syncedCount} event(s)`);
      // Mark events as synced in Dexie + Zustand
      await useEventStore.getState().markSynced(result.data.syncedIds);
    }
  } catch (err) {
    // Network errors are expected when offline — fail silently
    console.warn("⚠️ Sync attempt failed:", err);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start the background sync engine.
 * - Syncs immediately on startup (if online)
 * - Sets up interval-based syncing
 * - Listens for browser `online` events
 */
export function startSyncEngine(): void {
  // Initial sync attempt
  syncPendingEvents();

  // Interval-based sync
  syncInterval = setInterval(syncPendingEvents, SYNC_CONFIG.SYNC_INTERVAL_MS);

  // Sync when coming back online
  window.addEventListener("online", () => {
    console.log("🌐 Back online — triggering sync");
    syncPendingEvents();
  });

  window.addEventListener("offline", () => {
    console.log("📴 Went offline — sync paused");
  });

  console.log(
    `🔄 Sync engine started (interval: ${SYNC_CONFIG.SYNC_INTERVAL_MS / 1000}s)`
  );
}

/**
 * Stop the background sync engine.
 */
export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log("🔄 Sync engine stopped");
}

/** Manually trigger a sync (e.g. from a UI button) */
export { syncPendingEvents as triggerSync };
