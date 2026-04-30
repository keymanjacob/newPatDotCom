// ──────────────────────────────────────────────
// Baby Tracker — Container API Entry Point
//
// Pure Express server. No Azure Functions wrapper.
// Designed to run inside a Docker container on any
// container host (Azure Container Apps, Fly.io, Railway, etc.)
// ──────────────────────────────────────────────

// Load .env relative to this file's directory, not process.cwd().
// dotenv/config uses cwd which may be the monorepo root when run via turbo.
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

import express from "express";
import cors from "cors";
import morgan from "morgan";
import type { HealthResponse, ApiResponse } from "@baby-tracker/shared";
import { initDatabase, ensureSchema } from "./db/neon.js";
import { eventsRouter } from "./routes/events.js";
import { trendsRouter, activityRouter } from "./routes/trends.js";
import { realtimeRouter } from "./routes/realtime.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ── Middleware ────────────────────────────────

app.use(morgan("combined"));

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

app.use("/api/events",    eventsRouter);
app.use("/api/trends",    trendsRouter);
app.use("/api/activity",  activityRouter);
app.use("/api/negotiate", realtimeRouter);

// ── Startup ──────────────────────────────────

async function start(): Promise<void> {
  try {
    initDatabase();
    await ensureSchema();
  } catch (err) {
    // Hard-fail on any DB error — a server with no DB only serves 500s,
    // which is worse than not starting at all.
    console.error("❌ Fatal: could not initialize database.");
    console.error("   Check that DATABASE_URL is set in packages/server-container/.env");
    console.error("   Underlying error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
┌─────────────────────────────────────────┐
│  🍼 Baby Tracker API (Container)        │
│  http://0.0.0.0:${PORT}                    │
│  /api/health  /api/events               │
│  /api/trends  /api/activity             │
└─────────────────────────────────────────┘
    `);
  });
}

start();
