// ──────────────────────────────────────────────
// Baby Tracker — Bottom Navigation
// ──────────────────────────────────────────────

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type TabId = "today" | "trends";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M6.34 17.66l-1.41 1.41" />
      <path d="M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 flex-1 py-3 px-6
        rounded-2xl text-sm font-semibold transition-all duration-200
        touch-target press-scale
        ${
          active
            ? "bg-accent-navy text-white shadow-lg"
            : "bg-transparent text-text-secondary"
        }
      `}
    >
      {icon}
      <span className="uppercase tracking-wide text-xs">{label}</span>
    </button>
  );
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="sticky bottom-0 bg-surface-card border-t border-border-subtle safe-bottom">
      <div className="max-w-md mx-auto flex items-center gap-2 p-3">
        <TabButton
          active={activeTab === "today"}
          onClick={() => onTabChange("today")}
          icon={<SunIcon />}
          label={t("bottomNav.today")}
        />
        <TabButton
          active={activeTab === "trends"}
          onClick={() => onTabChange("trends")}
          icon={<ChartIcon />}
          label={t("bottomNav.trends")}
        />
      </div>
    </nav>
  );
}
