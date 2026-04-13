import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "zh" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-card border border-border-subtle shadow-sm hover:bg-surface-hover transition-colors duration-200"
      aria-label="Toggle language"
    >
      <span className="text-lg leading-none">🌐</span>
      <span className="text-xs font-semibold text-text-secondary w-8 text-center uppercase tracking-wider">
        {i18n.language === "en" ? "EN" : "中"}
      </span>
    </button>
  );
}
