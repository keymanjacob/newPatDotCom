// ──────────────────────────────────────────────
// Baby Tracker — Background Sync Engine
// ──────────────────────────────────────────────
//
// PUSH (client → server)
//   Primary:  eventStore.addEvent() fires an instant POST on every tap.
//   Safety net: setInterval(sweepPendingEvents, 30s) retries any event
//               still marked pending after a cold-start timeout or offline gap.
//
// PULL (server → client)
//   Primary:  Azure Web PubSub WebSocket — server broadcasts
//             {"type":"events_updated"} after every successful POST.
//             Clients receive it and pull immediately (~1s latency).
//   Safety net: setInterval(pullFromServer, 60s) — catches missed signals
//               when the WebSocket was killed by iOS/Android battery savers,
//               a Wi-Fi → cellular switch, or the screen locking.
//   Also triggered: app load, tab becomes visible, browser comes back online.
//
//   WebSocket reconnect strategy:
//     • 503 "not configured" → feature is intentionally disabled, do not retry.
//     • 404 / 5xx / network error → transient (deploy gap, cold start, etc.),
//       retry with exponential backoff (3s → 6s → 12s → 24s → 30s cap).
// ──────────────────────────────────────────────

import { db } from "../db/dexie";
import { useEventStore } from "./eventStore";
import { pushEvents, pullEvents } from "../api";
import {
  SYNC_CONFIG,
  API_ROUTES,
  type ApiResponse,
} from "@baby-tracker/shared";

// ── Sweep: push any events still pending after instant-push failure ───────────

let sweepInterval: ReturnType<typeof setInterval> | null = null;
let isSweeping = false;

async function sweepPendingEvents(): Promise<void> {
  if (isSweeping || !navigator.onLine) return;
  isSweeping = true;

  try {
    const pending = await db.events
      .where("sync_status")
      .equals("pending")
      .limit(SYNC_CONFIG.BATCH_SIZE)
      .toArray();

    if (pending.length === 0) return;

    console.log(`🔄 Sweeping ${pending.length} pending event(s)...`);
    const result = await pushEvents(pending);

    if (result?.syncedIds.length) {
      console.log(`✅ Swept ${result.syncedCount} event(s)`);
      await useEventStore.getState().markSynced(result.syncedIds);
    }
  } catch (err) {
    console.warn("⚠️ Sweep failed:", err);
  } finally {
    isSweeping = false;
  }
}

// ── Pull: hydrate local Dexie from server ─────────────────────────────────────

let pullInterval: ReturnType<typeof setInterval> | null = null;

async function pullFromServer(): Promise<void> {
  try {
    const data = await pullEvents();
    if (!data || data.length === 0) return;

    const hydrated = data.map((e) => ({ ...e, sync_status: "synced" as const }));
    await db.events.bulkPut(hydrated);
    await useEventStore.getState().loadEvents();
    console.log(`✅ Pulled and merged ${hydrated.length} event(s)`);
  } catch (err) {
    console.warn("⚠️ Pull failed:", err);
  }
}

// ── Realtime WebSocket (Azure Web PubSub) ─────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 3_000;
const MAX_RECONNECT_DELAY = 30_000;

async function connectRealtime(): Promise<void> {
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
      if (res.status === 503) {
        // Intentionally disabled (no connection string configured) — stop retrying.
        console.log("ℹ️ Realtime not configured — polling-only mode");
        return;
      }
      // Transient failure (404 = not deployed yet, 5xx = cold start, etc.)
      // Retry with backoff — once the deploy lands this will self-heal.
      console.warn(`⚠️ negotiate ${res.status} — retrying in ${reconnectDelay / 1000}s`);
      scheduleReconnect();
      return;
    }

    const body: ApiResponse<{ url: string }> = await res.json();
    if (!body.success || !body.data?.url) {
      scheduleReconnect();
      return;
    }

    ws = new WebSocket(body.data.url);

    ws.onopen = () => {
      console.log("🔌 Realtime connected (Azure Web PubSub)");
      reconnectDelay = 3_000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "events_updated") {
          console.log("📡 Remote change — pulling...");
          pullFromServer();
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      ws = null;
      console.log(`🔌 WS closed — reconnecting in ${reconnectDelay / 1000}s`);
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close(); // onclose will fire and schedule reconnect
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

// ── Engine Lifecycle ──────────────────────────────────────────────────────────

export function startSyncEngine(): void {
  // Hydrate on load, then flush any events that were pending from a previous session.
  pullFromServer().then(() => sweepPendingEvents());

  // Open real-time channel.
  connectRealtime();

  // 30s sweep — safety net for instant-push failures only (offline, cold-start).
  sweepInterval = setInterval(sweepPendingEvents, SYNC_CONFIG.SYNC_INTERVAL_MS);

  // 60s pull — safety net for when the WebSocket was killed by the OS
  // (iOS/Android battery saver, screen lock, Wi-Fi↔cellular switch).
  pullInterval = setInterval(pullFromServer, 60_000);

  // Pull + reconnect when tab comes back into focus.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pullFromServer();
      connectRealtime();
    }
  });

  // Network recovery.
  window.addEventListener("online", () => {
    console.log("🌐 Back online — syncing");
    pullFromServer().then(() => sweepPendingEvents());
    connectRealtime();
  });

  window.addEventListener("offline", () => {
    console.log("📴 Offline — sync paused");
    disconnectRealtime();
  });

  console.log(
    `🔄 Sync engine started — sweep: ${SYNC_CONFIG.SYNC_INTERVAL_MS / 1000}s, pull fallback: 60s`
  );
}

export function stopSyncEngine(): void {
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null; }
  if (pullInterval)  { clearInterval(pullInterval);  pullInterval  = null; }
  disconnectRealtime();
  console.log("🔄 Sync engine stopped");
}

export { sweepPendingEvents as triggerSync };
