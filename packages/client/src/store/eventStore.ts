// ──────────────────────────────────────────────
// Baby Tracker — Zustand Event Store
// ──────────────────────────────────────────────
// Optimistic UI: write to Dexie first, update
// React state, then let sync engine handle the rest.
// ──────────────────────────────────────────────

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/dexie";
import type {
  BabyEvent,
  EventType,
  EventValue,
} from "@baby-tracker/shared";

interface EventState {
  /** Recent events loaded from Dexie (reverse chronological) */
  events: BabyEvent[];
  /** Number of events pending sync */
  pendingCount: number;
  /** Whether initial load from Dexie is complete */
  isLoaded: boolean;

  /** Load events from Dexie (called once on app mount) */
  loadEvents: () => Promise<void>;
  /** Add a new event — writes to Dexie immediately, no network wait */
  addEvent: (type: EventType, value: EventValue) => Promise<BabyEvent>;
  /** Mark events as synced (called by sync engine) */
  markSynced: (ids: string[]) => Promise<void>;
  /** Refresh pending count from Dexie */
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

    // 1. Write to Dexie IMMEDIATELY (optimistic)
    await db.events.add(event);

    // 2. Update React state (no network wait)
    set((state) => ({
      events: [event, ...state.events].slice(0, 100),
      pendingCount: state.pendingCount + 1,
    }));

    return event;
  },

  markSynced: async (ids) => {
    // Bulk update in Dexie
    await db.events
      .where("id")
      .anyOf(ids)
      .modify({ sync_status: "synced" as const });

    // Update React state
    set((state) => ({
      events: state.events.map((e) =>
        ids.includes(e.id) ? { ...e, sync_status: "synced" as const } : e
      ),
    }));

    // Refresh pending count
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
