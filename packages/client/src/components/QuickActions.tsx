// ──────────────────────────────────────────────
// Baby Tracker — Quick Action Cards
// ──────────────────────────────────────────────
// Expandable action cards matching the Pencil design:
// - Bottle → 2oz / 4oz / 6oz + Cancel
// - Wake Up → Zz
// - Diaper → Wet / Dirty + Cancel
// ──────────────────────────────────────────────

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventType, EventValue } from "@baby-tracker/shared";

interface QuickActionsProps {
  onLog: (type: EventType, value: EventValue) => void;
  isSleeping: boolean;
}

function BottleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v4" /><path d="M14 2v4" />
      <rect x="8" y="6" width="8" height="16" rx="2" />
      <path d="M8 10h8" />
    </svg>
  );
}

function SleepIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function DiaperIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c-4.97 0-9-2.24-9-5V7h18v10c0 2.76-4.03 5-9 5Z" />
      <path d="M3 7c0-2.76 4.03-5 9-5s9 2.24 9 5" />
      <path d="M12 2v20" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function QuickActions({ onLog, isSleeping }: QuickActionsProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<"bottle" | "diaper" | null>(null);

  const handleBottle = (oz: number) => {
    onLog("feed", { method: "bottle" as const, amountOz: oz });
    setExpanded(null);
  };

  const handleDiaper = (condition: "wet" | "dirty") => {
    onLog("diaper", { condition });
    setExpanded(null);
  };

  const handleSleep = () => {
    if (isSleeping) {
      // End nap
      onLog("sleep", {
        action: "stop" as const,
        durationMinutes: null,
        startTimestamp: null,
      });
    } else {
      // Start nap
      onLog("sleep", {
        action: "start" as const,
        durationMinutes: null,
        startTimestamp: null,
      });
    }
  };

  return (
    <div className="px-5 space-y-3">
      {/* Bottle Card */}
      <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "bottle" ? null : "bottle")}
          className="w-full flex items-center justify-between px-5 py-4 touch-target press-scale"
        >
          <div className="flex items-center gap-3">
            <span className="text-text-secondary">
              <BottleIcon />
            </span>
            <span className="text-lg font-semibold text-text-primary">
              {t("quickActions.bottle")}
            </span>
          </div>
          <span
            className={`text-text-tertiary transition-transform duration-200 ${
              expanded === "bottle" ? "rotate-90" : ""
            }`}
          >
            <ChevronRight />
          </span>
        </button>

        {expanded === "bottle" && (
          <div className="px-5 pb-4 flex items-center gap-3">
            {[2, 4, 6].map((oz) => (
              <button
                key={oz}
                onClick={() => handleBottle(oz)}
                className="flex-1 py-2.5 border border-border-light rounded-xl text-sm font-semibold
                           text-text-primary bg-surface-primary press-scale touch-target
                           active:bg-accent-navy active:text-white transition-colors"
              >
                {oz}{t("quickActions.oz")}
              </button>
            ))}
            <button
              onClick={() => setExpanded(null)}
              className="text-sm text-text-tertiary font-medium px-3 py-2.5"
            >
              {t("quickActions.cancel", "Cancel")}
            </button>
          </div>
        )}
      </div>

      {/* Wake Up / Sleep Card */}
      <button
        onClick={handleSleep}
        className={`
          w-full flex items-center justify-between px-5 py-4 rounded-2xl
          touch-target press-scale transition-all duration-200
          ${
            isSleeping
              ? "bg-accent-navy text-white"
              : "bg-accent-navy text-white"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <SleepIcon />
          <span className="text-lg font-semibold">
            {isSleeping ? t("quickActions.wakeUp") : t("quickActions.sleep")}
          </span>
        </div>
        <span className="text-lg opacity-75">
          {isSleeping ? "☀️" : "Zz"}
        </span>
      </button>

      {/* Diaper Card */}
      <div className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === "diaper" ? null : "diaper")}
          className="w-full flex items-center justify-between px-5 py-4 touch-target press-scale"
        >
          <div className="flex items-center gap-3">
            <span className="text-text-secondary">
              <DiaperIcon />
            </span>
            <span className="text-lg font-semibold text-text-primary">
              {t("quickActions.diaper")}
            </span>
          </div>
          <span
            className={`text-text-tertiary transition-transform duration-200 ${
              expanded === "diaper" ? "rotate-90" : ""
            }`}
          >
            <ChevronRight />
          </span>
        </button>

        {expanded === "diaper" && (
          <div className="px-5 pb-4 flex items-center gap-3">
            <button
              onClick={() => handleDiaper("wet")}
              className="flex-1 py-2.5 border border-border-light rounded-xl text-sm font-semibold
                         text-text-primary bg-surface-primary press-scale touch-target
                         active:bg-accent-navy active:text-white transition-colors"
            >
              {t("quickActions.wet")}
            </button>
            <button
              onClick={() => handleDiaper("dirty")}
              className="flex-1 py-2.5 border border-border-light rounded-xl text-sm font-semibold
                         text-text-primary bg-surface-primary press-scale touch-target
                         active:bg-accent-navy active:text-white transition-colors"
            >
              {t("quickActions.dirty")}
            </button>
            <button
              onClick={() => setExpanded(null)}
              className="text-sm text-text-tertiary font-medium px-3 py-2.5"
            >
              {t("quickActions.cancel", "Cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
