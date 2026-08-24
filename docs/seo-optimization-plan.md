# SEO 优化方案

## 当前状态诊断

### 关键缺陷

| 问题 | 影响 | 严重性 |
|------|------|--------|
| 无 Open Graph 标签（`og:title` 等） | 社交分享无预览卡片，减少外链 | 高 |
| 无 Twitter Card 标签 | Twitter/LinkedIn 分享不可用 | 高 |
| 无 `<link rel="canonical">` | 重复内容风险（如 `/posts/slug` vs `/posts/slug/`） | 高 |
| 无 `robots.txt`（被 Cloudflare 注入版本覆盖，缺少 `Sitemap:` 指令） | 搜索引擎无法发现 sitemap | 高 |
| `<title>` 无站点品牌后缀 | SERP 中 `标题 \| lflops.ovh` 比纯标题 CTR 更高 | 中 |
| `[...slug].astro` permalink 缺 trailing slash | schema.org `mainEntityOfPage` 与实际页面 URL 不一致 | 低 |
| RSS 已安装但未启用 | 少一个内容发现渠道 | 低 |

### 你的建站情况

- `@astrojs/sitemap` 已正确安装，构建后在 `dist/sitemap-index.xml`
- `@astrojs/rss` 已安装但**未使用**
- Schema.org Article 结构化数据以 microdata 形式存在（`itemscope`/`itemprop`），但不如 JSON-LD 强
- sitemap 经 curl 验证 URL 正确，Google 无法抓取的原因很可能是缺少 canonical URL 等基础 SEO 信号，且 robots.txt 没有 `Sitemap:` 指令

---

## 改造方案

### 1. 升级依赖

**文件**: `package.json`（仅改版本号）
**影响面**: 无 — `astro.config.mjs` 中 `sitemap()` 调用无需修改

```bash
bun update @astrojs/sitemap@^3.7.2
```

### 2. 新建 `public/robots.txt`

**文件**: `public/robots.txt`（新建，不影响现有代码）

```
User-agent: *
Allow: /
Sitemap: https://blog.lflops.ovh/sitemap-index.xml
```

> **注意**: Cloudflare 当前在边缘节点注入自己的 robots.txt（含 AI crawler 拦截规则），会覆盖此文件。部署后需在 Cloudflare 控制台将 `Sitemap:` 指令合并进去。

### 3. `src/layouts/Layout.astro` — 集中式 SEO 标签

**影响面**: 所有使用 `<Layout>` 的页面（`index.astro`、`[...slug].astro`、`page/[page].astro`、categories、tags、archives、friends 等）自动获得 canonical URL、OG/Twitter 标签、RSS 发现链接。

#### 3a. Props 新增字段

```typescript
interface Props {
  // ... 现有字段保持不变 ...
  description?: string;   // meta description / og:description
  ogImage?: string;       // og:image 完整 URL
  ogType?: string;        // 默认 "website"，文章页用 "article"
}
```

**影响面**: 所有传 `Props` 的调用方 — 新字段均为 optional，不传时使用默认值，现有调用方无需修改即可编译通过。

#### 3b. 计算标题和描述

在 `sidebarConfig` 等变量提取之后插入：

```typescript
const pageTitleWithSuffix = pageTitle
  ? `${pageTitle} | ${siteName}`
  : siteName;
const metaDescription = description || sidebarConfig?.description || "";
```

**影响面**: 仅改动 `<title>` 标签内容 — 所有页面的浏览器标签页标题会从 `文章标题` 变为 `文章标题 | lflops.ovh`。不影响页面内其他位置的标题显示。

#### 3c. 替换 `<head>` 内容

将现有 `<head>` 中的 `<title>` 和 `<slot name="head" />` 替换为完整的 SEO 标签块：

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="generator" content={Astro.generator} />
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />

  <title>{pageTitleWithSuffix}</title>
  <meta name="description" content={metaDescription} />

  <!-- Open Graph -->
  <meta property="og:title" content={pageTitleWithSuffix} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={Astro.url} />
  <meta property="og:type" content={ogType || "website"} />
  {ogImage && <meta property="og:image" content={ogImage} />}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitleWithSuffix} />
  <meta name="twitter:description" content={metaDescription} />
  {ogImage && <meta name="twitter:image" content={ogImage} />}

  <!-- Canonical URL -->
  <link rel="canonical" href={Astro.url} />

  <!-- RSS Discovery -->
  <link rel="alternate" type="application/rss+xml" href="/rss.xml" />

  <!-- 页面级 head 覆盖（放在最后，允许覆盖 Layout 默认值） -->
  <slot name="head" />
</head>
```

**影响面**:
- `<title>` 内容变化：所有页面标题加 `| lflops.ovh` 后缀
- `<slot name="head">` 移到 SEO 标签之后：之前通过 slot 注入的 `<meta name="description">` 现在会出现在 Layout 的 OG/Twitter 标签之后，但由于它们是重复的 meta，不产生功能冲突。后续步骤会删除各页面的重复 slot
- `og:image` / `twitter:image` 仅在有封面图时渲染（条件表达式），无封面的页面（categories、tags、archives）不会输出空的 og:image

### 4. `src/pages/posts/[...slug].astro` — 文章页 SEO

**影响面**: 仅影响文章详情页（6 篇文章），不影响首页、分类、标签、归档等页面。

#### 4a. 修复 permalink

```diff
- const permalink = `${Astro.site?.toString()}posts/${post.id}`;
+ const permalink = new URL(`/posts/${post.id}/`, Astro.site!).toString();
```

**影响面**: `permalink` 用于两处 — ① schema.org `mainEntityOfPage`（`<link>` 标签），② `<PostFooter>` 版权区链接。修复后 trailing slash 与实际页面 URL 一致。对页面渲染外观无视觉变化。

#### 4b. 计算 SEO 元数据

在 `postMeta` 变量之后插入：

```typescript
const description = post.data.description
  || post.body?.slice(0, 160).replace(/\s+/g, " ")
  || "";
const ogImage = post.data.cover
  ? new URL(post.data.cover.src, Astro.site!).toString()
  : undefined;
```

**影响面**: `post.data.cover` 来自 content collection schema 的 `image()` 类型，`.src` 是 Astro 构建后的图片路径（如 `/_astro/cover-1.C6izaf.webp`）。无 cover 的文章（当前大部分文章）ogImage 为 `undefined`，`og:image` 标签不会渲染。

#### 4c. 传新 props 给 Layout

```diff
  <Layout
    toc={toc}
    relatedPosts={relatedPosts}
    currentSlug={post.id}
    navigation={navigation}
    pageTitle={post.data.title}
    postMeta={postMeta}
+   description={description}
+   ogImage={ogImage}
+   ogType="article"
  >
```

**影响面**: 仅此文件，新增 3 个 prop 传递。

#### 4d. 删除重复的 meta description slot

删除 `<Fragment slot="head">` 整块（含 `<meta name="description">`），Layout 已统一处理。

**影响面**: 仅此文件，该 slot 内容与 Layout 新逻辑重复，删除后无功能丢失。

### 5. `src/pages/index.astro` — 首页 SEO

**影响面**: 仅首页 `/`。

#### 5a. 计算 SEO 元数据

在 `categories` 变量之后插入：

```typescript
const description = themeConfig.sidebar?.description?.slice(0, 160) || "";
const ogImage = covers.length > 0
  ? new URL(covers[0].src, Astro.site).toString()
  : undefined;
```

`covers` 从 `@/components/Images.astro` 导入（已在文件中通过 Layout 间接可用，直接 import 即可）。

#### 5b. 传新 props + 删除重复 slot

传 `description`、`ogImage` 给 Layout（ogType 省略，默认 "website"），删除 `<Fragment slot="head">` 中的 `<meta name="description">`。

### 6. `src/pages/page/[page].astro` — 分页 SEO

**影响面**: 仅分页页面 `/page/2/`、`/page/3/` 等。

与首页相同的模式：import `covers`，计算 description 和 ogImage，传 props 给 Layout，删除 `<Fragment slot="head">` 中的 `<meta name="description">`。

### 7. `src/pages/rss.xml.ts` — RSS Feed（新建）

**文件**: `src/pages/rss.xml.ts`（新建，不影响现有代码）
**输出路径**: `/rss.xml`（API 端点不受 `trailingSlash: "always"` 影响）

```typescript
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import themeConfig from "@/theme.config";

export async function GET(context: { site: URL }) {
  const posts = await getCollection("posts");
  const published = posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: themeConfig.siteName,
    description: themeConfig.sidebar?.description || "",
    site: context.site,
    items: published.map((post) => ({
      title: post.data.title,
      description: post.data.description || "",
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
    })),
  });
}
```

依赖 `@astrojs/rss` 已安装（^4.0.15），无需新增依赖。

### 8. 其他页面自动受益

以下页面通过 Layout 渲染，**无需任何代码修改**，自动获得 canonical URL、OG/Twitter 标签、RSS 发现链接：
- `categories/index.astro`、`[category].astro`
- `tags/index.astro`、`[tag].astro`
- `archives/index.astro`、`[year]/`、`[year]/[month]/`
- `friends/index.astro`

它们的 title 通过 `pageTitle` prop 传入，Layout 自动追加 `| lflops.ovh`，description 使用 `sidebar.description` 默认值，ogType 默认 `"website"`。

---

## 需要你手动做的事

1. 部署后确认 Cloudflare 的 robots.txt 包含 `Sitemap: https://blog.lflops.ovh/sitemap-index.xml` 指令（如果 Cloudflare 仍覆盖 `public/robots.txt`）
2. 到 [Google Search Console](https://search.google.com/search-console) 重新提交 sitemap: `https://blog.lflops.ovh/sitemap-index.xml`
3. 等待 1-4 周，谷歌逐步收录
4. 可以用 `site:blog.lflops.ovh` 在 Google 搜索中查看已收录页面

---

## 验证清单

- [ ] `bun run build` — 构建无错误
- [ ] `dist/` 下文章页 HTML 包含 `<title>...</title>` 含 `| lflops.ovh` 后缀，OG/Twitter/canonical 标签存在
- [ ] 首页 HTML 包含 `og:type="website"`、meta description
- [ ] `bun run dev` 后 `curl http://localhost:4321/rss.xml` 返回合法 XML
- [ ] `public/robots.txt` 内容正确
- [ ] 部署后 `curl https://blog.lflops.ovh/sitemap-0.xml` 所有 `<loc>` 合法
