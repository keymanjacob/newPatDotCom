// ──────────────────────────────────────────────
// Baby Tracker Server — Express Entry Point
// ──────────────────────────────────────────────
// Deployable to Azure App Service free tier.
// Azure sets process.env.PORT automatically.
// ──────────────────────────────────────────────

import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

import express from "express";
import cors from "cors";
import type { HealthResponse, ApiResponse } from "@baby-tracker/shared";
import { initDatabase, ensureSchema } from "./db/neon.js";
import { eventsRouter } from "./routes/events.js";
import { trendsRouter, activityRouter } from "./routes/trends.js";
import { realtimeRouter } from "./routes/realtime.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ── Middleware ────────────────────────────────

// Parse CORS origins from env (comma-separated) or allow all in dev
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : "*";

app.use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ── Routes ───────────────────────────────────

// Health check — used by Azure App Service health probes
app.get("/api/health", (_req, res) => {
  const response: ApiResponse<HealthResponse> = {
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    },
    error: null,
  };
  res.json(response);
});

// Events — sync endpoint
app.use("/api/events", eventsRouter);

// Trends — aggregated chart data
app.use("/api/trends", trendsRouter);

// Activity — today's timeline + summary
app.use("/api/activity", activityRouter);

// Realtime — negotiate WebSocket access token for Azure Web PubSub
app.use("/api/negotiate", realtimeRouter);

// ── Startup ──────────────────────────────────
export const expressApp: express.Express = app;

async function start() {
  try {
    // Initialize DB connection
    initDatabase();

    // Ensure tables exist (safe to run every startup)
    await ensureSchema();

    app.listen(PORT, () => {
      console.log(`
┌─────────────────────────────────────────┐
│  🍼 Baby Tracker API                    │
│  Running on http://localhost:${PORT}       │
│  Health:   /api/health                  │
│  Events:   /api/events                  │
└─────────────────────────────────────────┘
      `);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);

    // If DATABASE_URL is not set, start anyway for local dev
    if (
      err instanceof Error &&
      err.message.includes("DATABASE_URL")
    ) {
      console.warn(
        "⚠️  Starting without database. Set DATABASE_URL in .env to enable sync."
      );
      console.warn("   See packages/server/.env.example for details.\n");

      app.listen(PORT, () => {
        console.log(`
┌─────────────────────────────────────────┐
│  🍼 Baby Tracker API (NO DATABASE)      │
│  Running on http://localhost:${PORT}       │
│  Health:   /api/health                  │
│  Events:   ⚠️  Disabled (no DB)         │
└─────────────────────────────────────────┘
        `);
      });
    } else {
      process.exit(1);
    }
  }
}

// Only start the internal Express server if NOT running in Azure Functions
if (!process.env.FUNCTIONS_WORKER_RUNTIME) {
  start();
}
