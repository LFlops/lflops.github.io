import { defineConfig, presetAttributify, presetIcons, presetWind4 } from "unocss";
import themeConfig from "./src/theme.config";
import extractorSvelte from "@unocss/extractor-svelte";
import { transformerDirectives } from "unocss";

const iconSafeList = themeConfig.nav.flatMap((item) => {
  const icons: string[] = [];
  if (item.icon) {
    icons.push(item.icon);
  }
  if (item.dropboxItems) {
    item.dropboxItems.forEach((subItem) => {
      if (subItem.icon) {
        icons.push(subItem.icon);
      }
    });
  }
  return icons;
});

if (themeConfig.sidebar?.social) {
  Object.values(themeConfig.sidebar.social).forEach((value) => {
    const iconStr = value.icon;
    if (iconStr) {
      iconSafeList.push(iconStr.startsWith("i-") ? iconStr : `i-ri-${iconStr}`);
    }
  });
}

if (themeConfig.sidebar?.menu) {
  Object.values(themeConfig.sidebar.menu).forEach((value) => {
    const iconStr = value.icon;
    if (iconStr) {
      iconSafeList.push(iconStr.startsWith("i-") ? iconStr : `i-ri-${iconStr}`);
    }
  });
}

export default defineConfig({
  presets: [presetWind4(), presetIcons(), presetAttributify()],
  extractors: [extractorSvelte()],
  transformers: [transformerDirectives()],
  safelist: [...new Set(iconSafeList)],
});
