// ──────────────────────────────────────────────
// Baby Tracker Server — Events Route
// ──────────────────────────────────────────────

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type {
  SyncPayload,
  ApiResponse,
  SyncResponse,
} from "@baby-tracker/shared";
import { upsertEvents, getRecentEvents } from "../db/neon.js";
import { broadcastEventsUpdated } from "../lib/pubsub.js";

export const eventsRouter: IRouter = Router();

/**
 * POST /api/events
 * Accepts a batch of events from the client sync engine.
 * Performs upsert (INSERT ON CONFLICT) to handle retries gracefully.
 */
eventsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const payload = req.body as SyncPayload;

    // Basic validation
    if (!payload.events || !Array.isArray(payload.events)) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: "Invalid payload: 'events' array is required",
      };
      res.status(400).json(response);
      return;
    }

    if (payload.events.length === 0) {
      const response: ApiResponse<SyncResponse> = {
        success: true,
        data: { syncedCount: 0, syncedIds: [] },
        error: null,
      };
      res.status(200).json(response);
      return;
    }

    // Validate each event has required fields
    for (const event of payload.events) {
      if (!event.id || !event.type || !event.value || !event.timestamp) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `Invalid event: missing required fields (id, type, value, timestamp)`,
        };
        res.status(400).json(response);
        return;
      }

      if (!["sleep", "feed", "diaper"].includes(event.type)) {
        const response: ApiResponse = {
          success: false,
          data: null,
          error: `Invalid event type: '${event.type}'. Must be sleep, feed, or diaper.`,
        };
        res.status(400).json(response);
        return;
      }
    }

    const result = await upsertEvents(payload);

    const response: ApiResponse<SyncResponse> = {
      success: true,
      data: result,
      error: null,
    };

    console.log(
      `📥 Synced ${result.syncedCount} event(s): [${result.syncedIds.join(", ")}]`
    );

    // Notify other connected clients in real-time — fire-and-forget so it
    // never delays this response. If PubSub is not configured, this no-ops.
    broadcastEventsUpdated().catch((err) =>
      console.warn("⚠️ PubSub broadcast failed:", err)
    );

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error syncing events:", err);
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Internal server error during event sync",
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/events
 * Fetch recent events (for debugging / future features).
 */
eventsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const events = await getRecentEvents(50);
    const response: ApiResponse<typeof events> = {
      success: true,
      data: events,
      error: null,
    };
    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Internal server error fetching events",
    };
    res.status(500).json(response);
  }
});
