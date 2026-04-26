// ──────────────────────────────────────────────
// Baby Tracker — Events Route
// ──────────────────────────────────────────────

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type {
  SyncPayload,
  ApiResponse,
  SyncResponse,
  DeltaPullResponse,
} from "@baby-tracker/shared";
import { upsertEvents, getDeltaEvents } from "../db/neon.js";
import { broadcastEventsUpdated } from "../lib/pubsub.js";

export const eventsRouter: IRouter = Router();

/**
 * POST /api/events
 * Batch upsert from the client sync engine.
 * Idempotent — duplicate UUIDs overwrite the existing row (last-write-wins).
 */
eventsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const payload = req.body as SyncPayload;

    if (!payload.events || !Array.isArray(payload.events)) {
      const response: ApiResponse = { success: false, data: null, error: "Invalid payload: 'events' array required" };
      res.status(400).json(response);
      return;
    }

    if (payload.events.length === 0) {
      const response: ApiResponse<SyncResponse> = { success: true, data: { syncedCount: 0, syncedIds: [] }, error: null };
      res.status(200).json(response);
      return;
    }

    for (const event of payload.events) {
      if (!event.id || !event.type || !event.value || !event.timestamp) {
        const response: ApiResponse = { success: false, data: null, error: "Invalid event: missing required fields (id, type, value, timestamp)" };
        res.status(400).json(response);
        return;
      }
      if (!["sleep", "feed", "diaper"].includes(event.type)) {
        const response: ApiResponse = { success: false, data: null, error: `Invalid event type: '${event.type}'. Must be sleep, feed, or diaper.` };
        res.status(400).json(response);
        return;
      }
    }

    const result = await upsertEvents(payload);
    console.log(`📥 Synced ${result.syncedCount} event(s): [${result.syncedIds.join(", ")}]`);

    // Fire-and-forget broadcast — never delays the response
    broadcastEventsUpdated().catch((err) =>
      console.warn("⚠️ PubSub broadcast failed:", err)
    );

    const response: ApiResponse<SyncResponse> = { success: true, data: result, error: null };
    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error syncing events:", err);
    res.status(500).json({ success: false, data: null, error: "Internal server error during event sync" });
  }
});

/**
 * GET /api/events?since=<ISO>&limit=<n>
 *
 * Delta pull — returns only events with updated_at > since.
 *
 * - `since`  ISO 8601 timestamp of the client's last successful pull.
 *            Omit on first load; server defaults to the last 24 hours.
 * - `limit`  Max rows per response (default 200, max 500).
 *
 * Response includes `serverTime` — the client must store this and send it
 * as `since` on the next call. This keeps payloads near-constant regardless
 * of total history size (the delta sync fix documented in PRD Section 0).
 */
eventsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    if (since && isNaN(Date.parse(since))) {
      res.status(400).json({ success: false, data: null, error: "Invalid 'since' — must be an ISO 8601 timestamp" });
      return;
    }

    const limit = Math.min(parseInt(limitParam || "200", 10), 500);
    const result = await getDeltaEvents(since, limit);
    console.log(`📤 Delta pull (since=${since ?? "24h ago"}): ${result.events.length} event(s)`);

    const response: ApiResponse<DeltaPullResponse> = { success: true, data: result, error: null };
    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    res.status(500).json({ success: false, data: null, error: "Internal server error fetching events" });
  }
});
