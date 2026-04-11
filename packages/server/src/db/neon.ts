// ──────────────────────────────────────────────
// Baby Tracker Server — Neon Database Layer
// ──────────────────────────────────────────────

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { BabyEvent, SyncPayload, SyncResponse } from "@baby-tracker/shared";

let sql: NeonQueryFunction<false, false>;

/**
 * Initialize the Neon database connection.
 * Must be called once at server startup.
 */
export function initDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
      "See .env.example for setup instructions."
    );
  }
  sql = neon(databaseUrl);
  console.log("✅ Neon database connection initialized");
}

/**
 * Create the events table if it doesn't exist.
 * Uses IF NOT EXISTS so it's safe to call on every startup.
 */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id          UUID PRIMARY KEY,
      type        VARCHAR(10) NOT NULL CHECK (type IN ('sleep', 'feed', 'diaper')),
      value       JSONB NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Index for querying recent events
  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON events (timestamp DESC)
  `;

  // Index for querying by type
  await sql`
    CREATE INDEX IF NOT EXISTS idx_events_type
    ON events (type)
  `;

  console.log("✅ Database schema ensured");
}

/**
 * Upsert a batch of events using INSERT ... ON CONFLICT.
 * "Last write wins" — if a UUID already exists, we update it.
 */
export async function upsertEvents(
  payload: SyncPayload
): Promise<SyncResponse> {
  const syncedIds: string[] = [];

  for (const event of payload.events) {
    await sql`
      INSERT INTO events (id, type, value, timestamp)
      VALUES (
        ${event.id}::uuid,
        ${event.type},
        ${JSON.stringify(event.value)}::jsonb,
        ${event.timestamp}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        type       = EXCLUDED.type,
        value      = EXCLUDED.value,
        timestamp  = EXCLUDED.timestamp,
        updated_at = NOW()
    `;
    syncedIds.push(event.id);
  }

  return {
    syncedCount: syncedIds.length,
    syncedIds,
  };
}

/**
 * Fetch recent events from the database (for future use).
 */
export async function getRecentEvents(
  limit: number = 50
): Promise<Omit<BabyEvent, "sync_status">[]> {
  const rows = await sql`
    SELECT id, type, value, timestamp
    FROM events
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;

  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as BabyEvent["type"],
    value: row.value as BabyEvent["value"],
    timestamp: (row.timestamp as Date).toISOString(),
  }));
}
