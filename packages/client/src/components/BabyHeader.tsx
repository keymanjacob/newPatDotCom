// ──────────────────────────────────────────────
// Baby Tracker — Baby Header
// ──────────────────────────────────────────────
// Displays baby name, greeting, and summary pills.
// ──────────────────────────────────────────────

import type { TodaySummary } from "@baby-tracker/shared";
import { BABY_PROFILE } from "@baby-tracker/shared";

interface BabyHeaderProps {
  summary: TodaySummary;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { text: "Good night", emoji: "🌙" };
  if (hour < 12) return { text: "Good morning", emoji: "☀️" };
  if (hour < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (hour < 21) return { text: "Good evening", emoji: "🌇" };
  return { text: "Good night", emoji: "🌙" };
}

function BottleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v4" />
      <path d="M14 2v4" />
      <rect x="8" y="6" width="8" height="16" rx="2" />
      <path d="M8 10h8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export default function BabyHeader({ summary }: BabyHeaderProps) {
  const greeting = getGreeting();

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Name + Greeting */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-accent-purple-light flex items-center justify-center">
          <MoonIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {BABY_PROFILE.name}
          </h1>
          <p className="text-sm text-text-secondary">
            {greeting.text} {greeting.emoji}
          </p>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="flex gap-3">
        {summary.lastBottleAgo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-card rounded-full border border-border-subtle">
            <BottleIcon />
            <span className="text-xs text-text-secondary font-medium">
              Last Bottle: {summary.lastBottleAgo}
            </span>
          </div>
        )}
        {summary.lastNapAgo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-card rounded-full border border-border-subtle">
            <MoonIcon />
            <span className="text-xs text-text-secondary font-medium">
              Last Nap: {summary.lastNapAgo}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
