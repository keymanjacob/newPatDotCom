// ──────────────────────────────────────────────
// Baby Tracker — Zustand Event Store
// ──────────────────────────────────────────────
// Write order per event:
//   1. Dexie (IndexedDB) — instant, optimistic
//   2. React state (Zustand) — instant, optimistic
//   3. Network push — immediate async, non-blocking
//   4. 30s sweep in syncEngine — catches any pushes that failed
// ──────────────────────────────────────────────

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/dexie";
import { pushEvents } from "../api";
import type {
  BabyEvent,
  EventType,
  EventValue,
} from "@baby-tracker/shared";

interface EventState {
  events: BabyEvent[];
  pendingCount: number;
  isLoaded: boolean;

  loadEvents: () => Promise<void>;
  addEvent: (type: EventType, value: EventValue) => Promise<BabyEvent>;
  markSynced: (ids: string[]) => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  pendingCount: 0,
  isLoaded: false,

  loadEvents: async () => {
    const events = await db.events
      .orderBy("timestamp")
      .reverse()
      .limit(100)
      .toArray();

    const pendingCount = await db.events
      .where("sync_status")
      .equals("pending")
      .count();

    set({ events, pendingCount, isLoaded: true });
  },

  addEvent: async (type, value) => {
    const event: BabyEvent = {
      id: uuidv4(),
      type,
      value,
      timestamp: new Date().toISOString(),
      sync_status: "pending",
    };

    // Step 1 + 2: Write to Dexie and update React state immediately.
    // UI reflects the change before any network round-trip.
    await db.events.add(event);
    set((state) => ({
      events: [event, ...state.events].slice(0, 100),
      pendingCount: state.pendingCount + 1,
    }));

    // Step 3: Fire instant network push — non-blocking.
    // If this succeeds, mark synced right away so the 30s sweep skips it.
    // If it fails for any reason (offline, cold-start timeout, etc.), stay
    // pending — the sweep in syncEngine will retry automatically.
    pushEvents([event])
      .then(async (result) => {
        if (result?.syncedIds.includes(event.id)) {
          await get().markSynced([event.id]);
        }
      })
      .catch(() => {
        // Silent — sweep handles the retry.
      });

    return event;
  },

  markSynced: async (ids) => {
    await db.events
      .where("id")
      .anyOf(ids)
      .modify({ sync_status: "synced" as const });

    set((state) => ({
      events: state.events.map((e) =>
        ids.includes(e.id) ? { ...e, sync_status: "synced" as const } : e
      ),
    }));

    await get().refreshPendingCount();
  },

  refreshPendingCount: async () => {
    const pendingCount = await db.events
      .where("sync_status")
      .equals("pending")
      .count();
    set({ pendingCount });
  },
}));
