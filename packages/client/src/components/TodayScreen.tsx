// ──────────────────────────────────────────────
// Baby Tracker — Today Screen
// ──────────────────────────────────────────────
// Matches the "Today" Pencil design: baby header,
// quick action cards, and activity timeline.
// ──────────────────────────────────────────────

import { useMemo } from "react";
import { useEventStore } from "../store/eventStore";
import { useTodaySummary } from "../hooks/useTodaySummary";
import { useTodayActivity } from "../hooks/useTodayActivity";
import BabyHeader from "./BabyHeader";
import QuickActions from "./QuickActions";
import ActivityTimeline from "./ActivityTimeline";
import type { EventType, EventValue, SleepValue } from "@baby-tracker/shared";

export default function TodayScreen() {
  const { events, addEvent } = useEventStore();
  const summary = useTodaySummary(events);
  const { activities } = useTodayActivity(events);

  // Determine if baby is currently sleeping
  // Look at the most recent sleep event
  const isSleeping = useMemo(() => {
    const sleepEvents = events
      .filter((e) => e.type === "sleep")
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    if (sleepEvents.length === 0) return false;
    const latest = sleepEvents[0].value as SleepValue;
    return latest.action === "start";
  }, [events]);

  const handleLog = (type: EventType, value: EventValue) => {
    // If ending a nap, calculate duration
    if (type === "sleep") {
      const sleepVal = value as SleepValue;
      if (sleepVal.action === "stop" && isSleeping) {
        // Find the last sleep start
        const lastStart = events.find(
          (e) =>
            e.type === "sleep" &&
            (e.value as SleepValue).action === "start"
        );
        if (lastStart) {
          const startTime = new Date(lastStart.timestamp);
          const now = new Date();
          const durationMinutes = Math.round(
            (now.getTime() - startTime.getTime()) / 60000
          );
          value = {
            action: "stop" as const,
            durationMinutes,
            startTimestamp: lastStart.timestamp,
          };
        }
      }
    }
    addEvent(type, value);
  };

  return (
    <div className="flex-1 overflow-y-auto hide-scrollbar pb-4">
      <BabyHeader summary={summary} />
      <QuickActions onLog={handleLog} isSleeping={isSleeping} />
      <div className="mt-6">
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  );
}
