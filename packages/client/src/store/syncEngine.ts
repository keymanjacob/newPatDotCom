// ──────────────────────────────────────────────
// Baby Tracker — Background Sync Engine
// ──────────────────────────────────────────────
// Two-layer sync strategy:
//
// Layer 1 — Push (client → server)
//   Interval-based: flushes locally-pending events to the server
//   every SYNC_INTERVAL_MS. Retries automatically on next tick.
//
// Layer 2 — Pull (server → client, real-time)
//   Azure Web PubSub WebSocket: server broadcasts {"type":"events_updated"}
//   whenever any client saves new events. Receiving clients call
//   pullEventsFromServer() immediately — no polling needed.
//   Falls back gracefully to interval-only if Web PubSub is not configured.
//
// Additional pull triggers (no extra server cost):
//   • App mount (initial hydration)
//   • Tab becomes visible (user switches back to app)
//   • Browser comes back online
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

// ── Push (client → server) ───────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

async function syncPendingEvents(): Promise<void> {
  if (isSyncing) return;
  if (!navigator.onLine) return;

  isSyncing = true;

  try {
    const pendingEvents = await db.events
      .where("sync_status")
      .equals("pending")
      .limit(SYNC_CONFIG.BATCH_SIZE)
      .toArray();

    if (pendingEvents.length === 0) return;

    console.log(`🔄 Syncing ${pendingEvents.length} event(s)...`);

    const payload: SyncPayload = {
      events: pendingEvents.map(({ sync_status: _, ...event }) => event),
    };

    const baseUrl = import.meta.env.VITE_API_URL || "";
    const response = await fetch(`${baseUrl}${API_ROUTES.EVENTS}`, {
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
      await useEventStore.getState().markSynced(result.data.syncedIds);
    }
  } catch (err) {
    console.warn("⚠️ Sync attempt failed:", err);
  } finally {
    isSyncing = false;
  }
}

// ── Pull (server → client) ───────────────────

async function pullEventsFromServer(): Promise<void> {
  if (!navigator.onLine) return;

  try {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const response = await fetch(`${baseUrl}${API_ROUTES.EVENTS}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.warn(`⚠️ Pull failed with status ${response.status}`);
      return;
    }

    const result: ApiResponse<any[]> = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      const hydratedEvents = result.data.map((event) => ({
        ...event,
        sync_status: "synced" as const,
      }));

      await db.events.bulkPut(hydratedEvents);
      await useEventStore.getState().loadEvents();
      console.log(`✅ Pulled and merged ${hydratedEvents.length} event(s)`);
    }
  } catch (err) {
    console.warn("⚠️ Pull attempt failed:", err);
  }
}

// ── Realtime WebSocket (Azure Web PubSub) ─────
//
// The server broadcasts {"type":"events_updated"} via Web PubSub after every
// successful events POST. Clients connect directly to Web PubSub using a
// signed URL from the negotiate endpoint — no WebSocket proxy through the
// Functions/Express layer.
//
// Connection lifecycle:
//   connect → open → [messages] → close → reconnect (exponential backoff)
//   Pauses reconnect attempts when offline; resumes on "online" event.

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 3_000; // ms — doubles on each failure, capped at 30s
const MAX_RECONNECT_DELAY = 30_000;

async function connectRealtime(): Promise<void> {
  // Don't open a second connection if one is already alive
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  if (!navigator.onLine) return;

  try {
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${baseUrl}${API_ROUTES.REALTIME_NEGOTIATE}`);

    if (!res.ok) {
      // Server not configured with Web PubSub — polling-only mode, no action needed
      return;
    }

    const body: ApiResponse<{ url: string }> = await res.json();
    if (!body.success || !body.data?.url) return;

    // Native browser WebSocket — no SDK needed. The signed URL already
    // includes the hub name and JWT via the `access_token` query param.
    ws = new WebSocket(body.data.url);

    ws.onopen = () => {
      console.log("🔌 Realtime connected (Azure Web PubSub)");
      reconnectDelay = 3_000; // reset backoff on successful open
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "events_updated") {
          console.log("📡 Remote change detected — pulling fresh data...");
          pullEventsFromServer();
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      ws = null;
      console.log(
        `🔌 Realtime disconnected — reconnecting in ${reconnectDelay / 1000}s`
      );
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror, which schedules the reconnect
      ws?.close();
    };
  } catch (err) {
    console.warn("⚠️ Realtime connect failed:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer || !navigator.onLine) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRealtime();
  }, reconnectDelay);
  // Exponential backoff: 3s → 6s → 12s → 24s → 30s (cap)
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function disconnectRealtime(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
}

// ── Engine Lifecycle ──────────────────────────

export function startSyncEngine(): void {
  // Initial hydration: pull remote data, then flush any local-pending events
  pullEventsFromServer().then(() => syncPendingEvents());

  // Open the real-time WebSocket channel
  connectRealtime();

  // Interval-based push: flushes pending local events on a regular cadence.
  // This does NOT pull — WebSocket handles that. Acts as retry for offline events.
  syncInterval = setInterval(syncPendingEvents, SYNC_CONFIG.SYNC_INTERVAL_MS);

  // When the tab becomes visible again, immediately refresh data and ensure
  // the WebSocket is still alive (browsers may have suspended it in the background)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pullEventsFromServer();
      connectRealtime();
    }
  });

  // Network recovery
  window.addEventListener("online", () => {
    console.log("🌐 Back online — syncing");
    pullEventsFromServer().then(() => syncPendingEvents());
    connectRealtime();
  });

  window.addEventListener("offline", () => {
    console.log("📴 Offline — sync paused");
    disconnectRealtime();
  });

  console.log(
    `🔄 Sync engine started (push interval: ${SYNC_CONFIG.SYNC_INTERVAL_MS / 1000}s, realtime: WebSocket)`
  );
}

export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  disconnectRealtime();
  console.log("🔄 Sync engine stopped");
}

export { syncPendingEvents as triggerSync };
