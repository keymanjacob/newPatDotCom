// ──────────────────────────────────────────────
// Baby Tracker — Azure Web PubSub Helper
//
// Set AZURE_WEB_PUBSUB_CONNECTION_STRING in env.
// If unset, all calls gracefully no-op — app falls
// back to interval-based polling (still works fine).
//
// Free tier (F1): 20 concurrent connections, 20k messages/day.
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

export async function broadcastEventsUpdated(): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.sendToAll({ type: "events_updated" });
}

export async function generateClientAccessUrl(): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("AZURE_WEB_PUBSUB_CONNECTION_STRING is not set");
  const token = await client.getClientAccessToken({
    expirationTimeInMinutes: TOKEN_TTL_MINUTES,
  });
  return token.url;
}

export function isPubSubConfigured(): boolean {
  return !!process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
}
