// ──────────────────────────────────────────────
// Baby Tracker — Minimal App Shell
// ──────────────────────────────────────────────
// This is a MINIMAL UI scaffold to verify:
// 1. Dexie writes work offline
// 2. Zustand state updates optimistically
// 3. Sync engine communicates with the server
//
// Detailed UI design will come separately.
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useEventStore } from "./store/eventStore";
import { startSyncEngine, triggerSync } from "./store/syncEngine";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import type {
  FeedValue,
  SleepValue,
  DiaperValue,
  HealthResponse,
  ApiResponse,
} from "@baby-tracker/shared";
import { API_ROUTES } from "@baby-tracker/shared";

export default function App() {
  const { events, pendingCount, isLoaded, loadEvents, addEvent } =
    useEventStore();
  const isOnline = useOnlineStatus();
  const [healthStatus, setHealthStatus] = useState<string>("checking...");

  // Load events from Dexie + start sync engine on mount
  useEffect(() => {
    loadEvents();
    startSyncEngine();
  }, [loadEvents]);

  // Check server health on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(API_ROUTES.HEALTH);
        const data: ApiResponse<HealthResponse> = await res.json();
        setHealthStatus(
          data.success ? `✅ ${data.data?.status}` : `❌ ${data.error}`
        );
      } catch {
        setHealthStatus("❌ unreachable");
      }
    }
    checkHealth();
  }, []);

  // ── Quick Actions (for testing) ──────────

  const logFeed = () => {
    const value: FeedValue = { method: "bottle", amountOz: 4 };
    addEvent("feed", value);
  };

  const logSleep = () => {
    const value: SleepValue = {
      action: "start",
      durationMinutes: null,
      startTimestamp: null,
    };
    addEvent("sleep", value);
  };

  const logDiaper = () => {
    const value: DiaperValue = { condition: "wet" };
    addEvent("diaper", value);
  };

  // ── Render ─────────────────────────────────

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-primary">
        <p className="text-text-secondary text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Header */}
      <header className="bg-surface-card border-b border-border-subtle px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text-primary">
            🍼 Baby Tracker
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isOnline ? "bg-status-online" : "bg-status-offline"
              }`}
            />
            <span className="text-text-secondary">
              {isOnline ? "Online" : "Offline"}
            </span>
            {pendingCount > 0 && (
              <span className="bg-accent-orange text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Server Health */}
        <section className="mb-6 p-4 bg-surface-card rounded-xl border border-border-subtle">
          <h2 className="text-sm font-medium text-text-secondary mb-1">
            Server Status
          </h2>
          <p className="text-base text-text-primary">{healthStatus}</p>
        </section>

        {/* Quick Action Buttons */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-text-secondary mb-3">
            Quick Log (Test Buttons)
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={logFeed}
              className="h-16 bg-accent-blue text-white rounded-xl text-base font-semibold
                         active:scale-95 transition-transform"
            >
              🍼 Feed
            </button>
            <button
              onClick={logSleep}
              className="h-16 bg-accent-purple text-white rounded-xl text-base font-semibold
                         active:scale-95 transition-transform"
            >
              😴 Sleep
            </button>
            <button
              onClick={logDiaper}
              className="h-16 bg-accent-teal text-white rounded-xl text-base font-semibold
                         active:scale-95 transition-transform"
            >
              🧷 Diaper
            </button>
          </div>
          <button
            onClick={triggerSync}
            className="mt-3 w-full h-12 bg-surface-muted text-text-secondary rounded-xl text-sm font-medium
                       active:scale-98 transition-transform"
          >
            🔄 Force Sync ({pendingCount} pending)
          </button>
        </section>

        {/* Event Log */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary mb-3">
            Recent Events ({events.length})
          </h2>
          {events.length === 0 ? (
            <p className="text-text-tertiary text-center py-8">
              No events yet. Tap a button above to log one.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="p-3 bg-surface-card rounded-lg border border-border-subtle
                             flex items-center justify-between"
                >
                  <div>
                    <span className="text-base font-medium">
                      {event.type === "feed"
                        ? "🍼"
                        : event.type === "sleep"
                          ? "😴"
                          : "🧷"}{" "}
                      {event.type}
                    </span>
                    <span className="text-xs text-text-tertiary ml-2">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      event.sync_status === "synced"
                        ? "bg-accent-green/15 text-accent-green"
                        : "bg-accent-orange/15 text-accent-orange"
                    }`}
                  >
                    {event.sync_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
