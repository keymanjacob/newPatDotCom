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
 * Pull events from the server and hydrate the local database.
 * This ensures cross-device sync works when opening on a new device.
 */
async function pullEventsFromServer(): Promise<void> {
  if (!navigator.onLine) return;

  try {
    console.log("📥 Pulling historical events from server...");
    const response = await fetch(API_ROUTES.EVENTS, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.warn(`⚠️ Pull failed with status ${response.status}`);
      return;
    }

    const result: ApiResponse<any[]> = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      // The server events don't store 'sync_status', so we explicitly
      // set them as 'synced' locally so we don't bounce them back.
      const hydratedEvents = result.data.map((event) => ({
        ...event,
        sync_status: "synced" as const,
      }));

      // Upsert into IndexedDB (won't duplicate because of UUID pk)
      await db.events.bulkPut(hydratedEvents);
      
      // Tell Zustand to refresh the UI
      await useEventStore.getState().loadEvents();
      console.log(`✅ Downloaded and merged ${hydratedEvents.length} events from cloud!`);
    }
  } catch (err) {
    console.warn("⚠️ Pull attempt failed:", err);
  }
}

/**
 * Start the background sync engine.
 * - Pulls latest data from server
 * - Syncs pending local data immediately (if online)
 * - Sets up interval-based syncing
 * - Listens for browser `online` events
 */
export function startSyncEngine(): void {
  // Sync strictly in order: Pull down fresh data, then Push pending data
  pullEventsFromServer().then(() => {
    syncPendingEvents();
  });

  // Interval-based sync (Push)
  syncInterval = setInterval(syncPendingEvents, SYNC_CONFIG.SYNC_INTERVAL_MS);

  // Sync when coming back online
  window.addEventListener("online", () => {
    console.log("🌐 Back online — triggering sync");
    pullEventsFromServer().then(() => syncPendingEvents());
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
