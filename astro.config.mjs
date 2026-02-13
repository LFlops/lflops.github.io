import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import esToolkitPlugin from "vite-plugin-es-toolkit";
import { transformerColorizedBrackets } from "@shikijs/colorized-brackets";
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
} from "@shikijs/transformers";

import UnoCSS from "unocss/astro";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkIns from "remark-ins";
import remarkDirective from "remark-directive";
import remarkRubyDirective from "remark-ruby-directive";
import rehypeAutoLinkHeadings from "rehype-autolink-headings";
import remarkEmoji from "remark-emoji";
import remarkExtendedTable from "remark-extended-table";
import remarkBreaks from "remark-breaks";

import AutoImport from "astro-auto-import";

import { hyacinePlugin } from "@hyacine/astro";
import mdx from "@astrojs/mdx";

import spoiler from "./src/remark-plugins/spoiler.mjs";

import Font from "vite-plugin-font";

// https://astro.build/config
export default defineConfig({
  site: "https://preview.astro.kaitaku.xyz",
  trailingSlash: "always",
  build: {
    format: "directory",
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  integrations: [
    UnoCSS({
      injectReset: true,
    }),
    svelte({
      compilerOptions: {
        customElement: true,
      },
    }),
    sitemap(),
    hyacinePlugin(),
    AutoImport({
      imports: [
        "@/components/mdx/Spoiler.astro",
        "@/components/mdx/Note.astro",
        "@/components/mdx/Label.astro",
        "@/components/mdx/Underline.astro",
        "@/components/mdx/Strike.astro",
        "@/components/mdx/Highlight.astro",
        "@/components/mdx/Text.astro",
        "@/components/mdx/Kbd.astro",
        "@/components/mdx/Sup.astro",
        "@/components/mdx/Sub.astro",
        "@/components/mdx/Collapse.astro",
      ],
    }),
    mdx(),
  ],

  vite: {
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).toString(),
      },
    },
    plugins: [
      Font.vite({
        scanFiles: ["src/**/*.{svelte,ts,tsx,js,jsx,md,mdx,json,astro}"],
      }),
      esToolkitPlugin(),
    ],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerNotationFocus(),
        transformerNotationErrorLevel(),
        transformerMetaHighlight(),
        transformerColorizedBrackets(),
      ],
    },
    remarkPlugins: [
      remarkMath,
      remarkBreaks,
      remarkRubyDirective,
      remarkIns,
      remarkDirective,
      remarkGfm,
      remarkEmoji,
      remarkExtendedTable,
      [spoiler, { title: "..." }],
    ],
    rehypePlugins: [rehypeKatex, rehypeAutoLinkHeadings],
  },
});
