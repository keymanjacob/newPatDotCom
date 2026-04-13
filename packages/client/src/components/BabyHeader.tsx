// ──────────────────────────────────────────────
// Baby Tracker — Baby Header
// ──────────────────────────────────────────────
// Displays baby name, greeting, summary pills, and language toggle.
// ──────────────────────────────────────────────

import type { TodaySummary } from "@baby-tracker/shared";
import { BABY_PROFILE } from "@baby-tracker/shared";
import { useTranslation } from "react-i18next";
import LanguageToggle from "./LanguageToggle";

interface BabyHeaderProps {
  summary: TodaySummary;
}

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "header.goodNight";
  if (hour < 12) return "header.goodMorning";
  if (hour < 17) return "header.goodAfternoon";
  if (hour < 21) return "header.goodEvening";
  return "header.goodNight";
}

function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "🌙";
  if (hour < 12) return "☀️";
  if (hour < 17) return "🌤️";
  if (hour < 21) return "🌇";
  return "🌙";
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
  const { t, i18n } = useTranslation();
  const greetingKey = getGreetingKey();
  const emoji = getGreetingEmoji();

  const formatAgo = (ts: string | null, fallback: string | null) => {
    if (!ts) return fallback;
    
    // We'll reproduce the server's logic but localized
    const past = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const isZh = i18n.language.startsWith("zh");

    if (diffMinutes < 1) return isZh ? "刚刚" : "just now";
    if (diffMinutes < 60) return isZh ? `${diffMinutes}分钟前` : `${diffMinutes}m ago`;

    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (mins === 0) return isZh ? `${hours}小时前` : `${hours}h ago`;
    const decimal = Math.round((mins / 60) * 10);
    return isZh ? `${hours}.${decimal}小时前` : `${hours}.${decimal}h ago`;
  };

  const bottleAgo = formatAgo(summary.lastBottleTimestamp, summary.lastBottleAgo);
  const napAgo = formatAgo(summary.lastNapTimestamp, summary.lastNapAgo);

  return (
    <div className="px-5 pt-6 pb-4 relative">
      {/* Top right language toggle */}
      <div className="absolute top-6 right-5">
        <LanguageToggle />
      </div>

      {/* Name + Greeting */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-accent-purple-light flex items-center justify-center">
          <MoonIcon />
        </div>
        <div className="pr-16">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            {BABY_PROFILE.name}
          </h1>
          <p className="text-sm text-text-secondary">
            {t(greetingKey)} {emoji}
          </p>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="flex gap-3">
        {(summary.lastBottleAgo || summary.lastBottleTimestamp) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-card rounded-full border border-border-subtle">
            <BottleIcon />
            <span className="text-xs text-text-secondary font-medium whitespace-nowrap">
              {t("header.lastBottle")}: {bottleAgo}
            </span>
          </div>
        )}
        {(summary.lastNapAgo || summary.lastNapTimestamp) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-card rounded-full border border-border-subtle">
            <MoonIcon />
            <span className="text-xs text-text-secondary font-medium whitespace-nowrap">
              {t("header.lastNap")}: {napAgo}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
