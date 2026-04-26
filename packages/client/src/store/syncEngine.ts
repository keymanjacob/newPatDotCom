// ──────────────────────────────────────────────
// Baby Tracker — Background Sync Engine
// ──────────────────────────────────────────────
//
// PUSH (client → server)
//   Primary:  eventStore.addEvent() fires an instant POST on every tap.
//   Safety net: setInterval(sweepPendingEvents, 30s) retries any event
//               still marked pending after a cold-start timeout or offline gap.
//
// PULL (server → client) — DELTA SYNC
//   The client persists `lastSyncedAt` in localStorage. Every pull sends
//   GET /api/events?since=<lastSyncedAt> and receives only changed rows.
//   On success, `serverTime` from the response becomes the new lastSyncedAt.
//   On first load / cache miss, `since` is omitted → server defaults to 24h.
//
//   Primary:  Azure Web PubSub WebSocket — server broadcasts
//             {"type":"events_updated"} after every successful POST.
//             Clients receive it and pull immediately (~1s latency).
//   Safety net: setInterval(pullFromServer, 60s) — catches missed signals.
//   Also triggered: app load, tab becomes visible, browser comes back online.
//
//   WebSocket reconnect strategy:
//     • 503 "not configured" → polling-only mode, stop retrying.
//     • 404 / 5xx / network error → exponential backoff (3s → 30s cap).
// ──────────────────────────────────────────────

import { db } from "../db/dexie";
import { useEventStore } from "./eventStore";
import { pushEvents, pullEvents } from "../api";
import {
  SYNC_CONFIG,
  API_ROUTES,
  type ApiResponse,
} from "@baby-tracker/shared";

// ── lastSyncedAt — persisted across page loads ────────────────────────────────

const LAST_SYNCED_KEY = "baby_tracker_last_synced_at";

function getLastSyncedAt(): string | undefined {
  return localStorage.getItem(LAST_SYNCED_KEY) ?? undefined;
}

function setLastSyncedAt(serverTime: string): void {
  localStorage.setItem(LAST_SYNCED_KEY, serverTime);
}

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

// ── Pull: delta-hydrate local Dexie from server ───────────────────────────────

let pullInterval: ReturnType<typeof setInterval> | null = null;

async function pullFromServer(): Promise<void> {
  try {
    const since = getLastSyncedAt();
    const result = await pullEvents(since);
    if (!result) return;

    const { events, serverTime } = result;

    if (events.length > 0) {
      const hydrated = events.map((e) => ({ ...e, sync_status: "synced" as const }));
      await db.events.bulkPut(hydrated);
      await useEventStore.getState().loadEvents();
      console.log(`✅ Delta pull: merged ${hydrated.length} event(s) (since=${since ?? "24h ago"})`);
    }

    // Always advance the cursor — even a zero-row response proves the server
    // had nothing new up to serverTime, so we can skip that window next time.
    setLastSyncedAt(serverTime);
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
        console.log("ℹ️ Realtime not configured — polling-only mode");
        return;
      }
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
          console.log("📡 Remote change — delta pulling...");
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
  // Delta pull on load, then flush any pending events from prior session.
  pullFromServer().then(() => sweepPendingEvents());

  connectRealtime();

  // 30s sweep — safety net for instant-push failures only.
  sweepInterval = setInterval(sweepPendingEvents, SYNC_CONFIG.SYNC_INTERVAL_MS);

  // 60s poll — safety net for when the WebSocket was killed by the OS.
  pullInterval = setInterval(pullFromServer, 60_000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pullFromServer();
      connectRealtime();
    }
  });

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
    `🔄 Sync engine started — sweep: ${SYNC_CONFIG.SYNC_INTERVAL_MS / 1000}s, poll: 60s, delta: enabled`
  );
}

export function stopSyncEngine(): void {
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null; }
  if (pullInterval)  { clearInterval(pullInterval);  pullInterval  = null; }
  disconnectRealtime();
  console.log("🔄 Sync engine stopped");
}

export { sweepPendingEvents as triggerSync };
