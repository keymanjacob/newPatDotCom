// ──────────────────────────────────────────────
// Baby Tracker — Trends & Activity Routes
// ──────────────────────────────────────────────

import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import type {
  ApiResponse,
  TrendSummary,
  ActivityItem,
  TodaySummary,
} from "@baby-tracker/shared";
import { getTrendData, getTodayActivity, getTodaySummary } from "../db/neon.js";

export const trendsRouter: IRouter = Router();

/**
 * GET /api/trends?period=week|month
 * Cold aggregation path — not called by the Today tab sync engine.
 * Computes pre-aggregated daily totals for the Trends view.
 */
trendsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "week";

    if (period !== "week" && period !== "month") {
      res.status(400).json({ success: false, data: null, error: "Invalid period: must be 'week' or 'month'" });
      return;
    }

    const data = await getTrendData(period);
    const response: ApiResponse<TrendSummary> = { success: true, data, error: null };
    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching trends:", err);
    res.status(500).json({ success: false, data: null, error: "Internal server error fetching trends" });
  }
});

export const activityRouter: IRouter = Router();

/**
 * GET /api/activity?date=YYYY-MM-DD
 * Returns today's (or specified date's) activity timeline + summary stats.
 * Single-request load for the Today header pills.
 */
activityRouter.get("/", async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, data: null, error: "Invalid date: must be YYYY-MM-DD" });
      return;
    }

    const [activities, summary] = await Promise.all([
      getTodayActivity(date),
      getTodaySummary(),
    ]);

    const response: ApiResponse<{ activities: ActivityItem[]; summary: TodaySummary }> = {
      success: true,
      data: { activities, summary },
      error: null,
    };
    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching activity:", err);
    res.status(500).json({ success: false, data: null, error: "Internal server error fetching activity" });
  }
});
