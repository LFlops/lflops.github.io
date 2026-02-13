import i18next from "i18next";
import themeConfig from "@/theme.config";

// Import translation files
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

// Type for supported locales
export type Locale = "zh-CN" | "en";

// Resources type
const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
} as const;

// Get current locale from theme config
const currentLocale = (themeConfig.locale as Locale) || "zh-CN";

/**
 * Initialize i18n with the locale from theme config
 */
export async function initI18n(locale: Locale = "zh-CN") {
  if (!i18next.isInitialized) {
    await i18next.init({
      lng: locale,
      fallbackLng: "zh-CN",
      resources,
      interpolation: {
        escapeValue: false, // React/Astro already handles escaping
      },
      showSupportNotice: false,
    });
  } else if (i18next.language !== locale) {
    await i18next.changeLanguage(locale);
  }
  return i18next;
}

/**
 * Get translation function for the configured locale
 */
export function getT(locale: Locale = "zh-CN") {
  if (!i18next.isInitialized || i18next.language !== locale) {
    // Synchronous init for SSR predictability
    void i18next.init({
      lng: locale,
      fallbackLng: "zh-CN",
      resources,
      interpolation: {
        escapeValue: false,
      },
      initImmediate: false,
    });
  }
  return i18next.t.bind(i18next);
}

/**
 * Helper to get locale from theme config
 */
export function getLocaleFromConfig(config: typeof themeConfig): Locale {
  return (config.locale as Locale) || "zh-CN";
}

/**
 * Pre-configured translation function using theme config locale
 * Import this directly in your components for convenience:
 *
 * import { t } from "@/i18n";
 *
 * <h1>{t("nav.home")}</h1>
 */
export const t = getT(currentLocale);

export { i18next };
