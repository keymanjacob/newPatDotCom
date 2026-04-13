// ──────────────────────────────────────────────
// Baby Tracker — Azure Web PubSub Helper
// ──────────────────────────────────────────────
// Wraps the Azure Web PubSub SDK.
//
// Set AZURE_WEB_PUBSUB_CONNECTION_STRING in your environment.
// If unset, all calls gracefully no-op — the app falls back to
// interval-based polling, which still works fine.
//
// Free tier (F1): 20 concurrent connections, 20,000 messages/day.
// A family of 4 logging ~20 events/day uses ~60 messages/day — 333× headroom.
// ──────────────────────────────────────────────

import { WebPubSubServiceClient } from "@azure/web-pubsub";

const HUB_NAME = "babytracker";
const TOKEN_TTL_MINUTES = 60;

let _client: WebPubSubServiceClient | null = null;

function getClient(): WebPubSubServiceClient | null {
  const connStr = process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
  if (!connStr) return null;
  if (!_client) {
    _client = new WebPubSubServiceClient(connStr, HUB_NAME);
  }
  return _client;
}

/**
 * Broadcast a tiny invalidation signal to all connected clients.
 * Clients receive this and trigger pullEventsFromServer().
 * Fire-and-forget — never delays the HTTP response.
 */
export async function broadcastEventsUpdated(): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.sendToAll({ type: "events_updated" });
}

/**
 * Generate a signed WebSocket URL for a client.
 * The URL embeds a short-lived JWT — valid for TOKEN_TTL_MINUTES.
 * Clients connect directly to Azure Web PubSub using this URL.
 */
export async function generateClientAccessUrl(): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("AZURE_WEB_PUBSUB_CONNECTION_STRING is not set");
  const token = await client.getClientAccessToken({
    expirationTimeInMinutes: TOKEN_TTL_MINUTES,
  });
  return token.url;
}

/** Whether Web PubSub is configured in this environment. */
export function isPubSubConfigured(): boolean {
  return !!process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
}
