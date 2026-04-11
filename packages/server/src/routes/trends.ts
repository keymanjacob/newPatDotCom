// ──────────────────────────────────────────────
// Baby Tracker Server — Trends & Activity Routes
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
 * Returns aggregated trend data (sleep, feed volume, diapers)
 * with daily breakdowns in chronological arrays.
 */
trendsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "week";

    if (period !== "week" && period !== "month") {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: "Invalid period: must be 'week' or 'month'",
      };
      res.status(400).json(response);
      return;
    }

    const data = await getTrendData(period);

    const response: ApiResponse<TrendSummary> = {
      success: true,
      data,
      error: null,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching trends:", err);
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Internal server error fetching trends",
    };
    res.status(500).json(response);
  }
});

export const activityRouter: IRouter = Router();

/**
 * GET /api/activity?date=YYYY-MM-DD
 * Returns today's (or specified date's) activity timeline items.
 *
 * Also returns summary stats (last bottle/nap ago) in headers
 * for efficient single-request loading.
 */
activityRouter.get("/", async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;

    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const response: ApiResponse = {
        success: false,
        data: null,
        error: "Invalid date format: must be YYYY-MM-DD",
      };
      res.status(400).json(response);
      return;
    }

    const [activities, summary] = await Promise.all([
      getTodayActivity(date),
      getTodaySummary(),
    ]);

    const response: ApiResponse<{
      activities: ActivityItem[];
      summary: TodaySummary;
    }> = {
      success: true,
      data: { activities, summary },
      error: null,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("❌ Error fetching activity:", err);
    const response: ApiResponse = {
      success: false,
      data: null,
      error: "Internal server error fetching activity",
    };
    res.status(500).json(response);
  }
});
