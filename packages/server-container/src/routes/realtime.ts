// ──────────────────────────────────────────────
// Baby Tracker — Realtime Negotiate Route
//
// GET /api/negotiate
//   → Returns a signed WSS URL valid for 60 minutes.
//   → Clients connect natively: new WebSocket(url)
//   → Returns 503 if PubSub is not configured —
//     clients detect this and fall back to polling.
// ──────────────────────────────────────────────

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type { ApiResponse } from "@baby-tracker/shared";
import { generateClientAccessUrl, isPubSubConfigured } from "../lib/pubsub.js";

export const realtimeRouter: IRouter = Router();

realtimeRouter.get("/", async (_req: Request, res: Response) => {
  if (!isPubSubConfigured()) {
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Realtime service not configured",
    };
    res.status(503).json(response);
    return;
  }

  try {
    const url = await generateClientAccessUrl();
    const response: ApiResponse<{ url: string }> = {
      success: true,
      data: { url },
      error: null,
    };
    res.json(response);
  } catch (err) {
    console.error("❌ Failed to generate Web PubSub token:", err);
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Failed to generate realtime token",
    };
    res.status(500).json(response);
  }
});
