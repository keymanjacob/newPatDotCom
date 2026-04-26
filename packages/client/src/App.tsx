// ──────────────────────────────────────────────
// Baby Tracker — App Shell
// ──────────────────────────────────────────────
// Tab-based navigation between Today and Trends.
// Matches the Pencil design layout.
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useEventStore } from "./store/eventStore";
import { startSyncEngine, stopSyncEngine } from "./store/syncEngine";
import BottomNav, { type TabId } from "./components/BottomNav";
import TodayScreen from "./components/TodayScreen";
import TrendsScreen from "./components/TrendsScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("today");
  const { isLoaded, loadEvents } = useEventStore();

  // Load events from Dexie + start sync engine on mount.
  // Cleanup is required — React 18 StrictMode runs effects twice in dev
  // (mount → unmount → remount). Without stopSyncEngine() here, two full
  // engines run in parallel, doubling every interval and API call.
  useEffect(() => {
    loadEvents();
    startSyncEngine();
    return () => stopSyncEngine();
  }, [loadEvents]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-surface-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-accent-navy border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-surface-primary flex flex-col max-w-md mx-auto relative">
      {/* Active Screen */}
      {activeTab === "today" ? <TodayScreen /> : <TrendsScreen />}

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
