// ──────────────────────────────────────────────
// Baby Tracker — Activity Timeline
// ──────────────────────────────────────────────
// Vertical timeline with dots and connector lines
// matching the Pencil design.
// ──────────────────────────────────────────────

import { useTranslation } from "react-i18next";
import type { ActivityItem } from "@baby-tracker/shared";

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

function getIcon(type: string) {
  switch (type) {
    case "sleep":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      );
    case "feed":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2v4" /><path d="M14 2v4" />
          <rect x="8" y="6" width="8" height="16" rx="2" />
          <path d="M8 10h8" />
        </svg>
      );
    case "diaper":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c-4.97 0-9-2.24-9-5V7h18v10c0 2.76-4.03 5-9 5Z" />
          <path d="M3 7c0-2.76 4.03-5 9-5s9 2.24 9 5" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ActivityTimeline({
  activities,
}: ActivityTimelineProps) {
  const { t, i18n } = useTranslation();

  const getLocalizedLabel = (item: ActivityItem) => {
    if (!item.value) return item.label;

    const type = item.type;
    const value = item.value as any;

    if (type === "feed") {
      const amount = value.amountOz;
      const method = value.method;
      const methodLabel = method === "bottle" ? t("timeline.formula") : t("timeline.breastFeed");
      return amount ? `${amount}${t("quickActions.oz")} ${methodLabel}` : methodLabel;
    } 
    
    if (type === "sleep") {
      return value.action === "start" ? t("timeline.napStarted") : t("timeline.wokeUp");
    } 
    
    if (type === "diaper") {
      const condition = value.condition;
      const condLabel = t(`quickActions.${condition}`);
      return `${t("timeline.diaper")} · ${condLabel}`;
    }

    return item.label;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(i18n.language, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (activities.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-text-tertiary text-sm">
          {t("timeline.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4">
      <h2 className="text-base font-semibold text-text-primary mb-4 italic">
        {t("timeline.title")}
      </h2>

      <div className="relative">
        {activities.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === activities.length - 1;

          return (
            <div key={item.id} className="flex gap-4 relative">
              {/* Timeline column */}
              <div className="flex flex-col items-center w-4 shrink-0">
                {/* Dot */}
                <div
                  className={`
                    w-3 h-3 rounded-full mt-4 z-10 shrink-0
                    ${isFirst ? "bg-accent-blue" : "bg-text-tertiary"}
                  `}
                />
                {/* Connector line */}
                {!isLast && (
                  <div className="w-px flex-1 border-l-2 border-dotted border-border-light my-1" />
                )}
              </div>

              {/* Event card */}
              <div
                className="flex-1 flex items-center justify-between bg-surface-card
                            rounded-xl border border-border-subtle px-4 py-3 mb-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary">{getIcon(item.type)}</span>
                  <span className="text-sm font-medium text-text-primary">
                    {getLocalizedLabel(item)}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary font-medium">
                  {formatTime(item.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
