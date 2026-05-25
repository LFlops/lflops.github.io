# SEO 优化方案

## 当前状态诊断

### 关键缺陷

| 问题 | 影响 | 严重性 |
|------|------|--------|
| 无 Open Graph 标签（`og:title` 等） | 社交分享无预览卡片，减少外链 | 高 |
| 无 Twitter Card 标签 | Twitter/LinkedIn 分享不可用 | 高 |
| 无 `<link rel="canonical">` | 重复内容风险（如 `/posts/slug` vs `/posts/slug/`） | 高 |
| 无 `robots.txt` | 搜索引擎无法发现 sitemap | 中 |
| `<title>` 无站点品牌后缀 | SERP 中 `标题 | lflops.ovh` 比纯标题 CTR 更高 | 中 |
| RSS 已安装但未启用 | 少一个内容发现渠道 | 低 |

### 你的建站情况

- `@astrojs/sitemap` 已正确安装，构建后在 `dist/sitemap-index.xml`
- `@astrojs/rss` 已安装但**未使用**
- Schema.org Article 结构化数据以 microdata 形式存在（`itemscope`/`itemprop`），但不如 JSON-LD 强

---

## 改造方案

### 1. `src/layouts/Layout.astro` — 集中式 SEO 标签

**Props 新增字段：**

```typescript
description?: string;   // meta description / og:description
ogImage?: string;       // og:image 完整 URL
ogType?: string;        // 默认 "website"，文章页用 "article"
```

**`<head>` 中新增的标签：**

```html
<!-- 标题加品牌后缀 -->
<title>{pageTitle} | {siteName}</title>

<!-- Meta description -->
<meta name="description" content={description || sidebarConfig.description} />

<!-- Open Graph -->
<meta property="og:title" content={pageTitle} />
<meta property="og:description" content={description || sidebarConfig.description} />
<meta property="og:url" content={Astro.url} />
<meta property="og:type" content={ogType || "website"} />
<meta property="og:image" content={ogImage} />  <!-- 仅当 ogImage 存在 -->

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={pageTitle} />
<meta name="twitter:description" content={description || sidebarConfig.description} />
<meta name="twitter:image" content={ogImage} />  <!-- 仅当 ogImage 存在 -->

<!-- Canonical URL -->
<link rel="canonical" href={Astro.url} />

<!-- RSS 发现 -->
<link rel="alternate" type="application/rss+xml" href="/rss.xml" />
```

### 2. `src/pages/posts/[...slug].astro` — 文章页 SEO 数据

```typescript
// 传给 Layout
const description = post.data.description || post.body?.slice(0, 150).replace(/\s+/g, " ");
const ogImage = post.data.cover
  ? new URL(post.data.cover.src, Astro.site).toString()
  : undefined;
```

然后通过 Layout props 传入：`description={description} ogImage={ogImage} ogType="article"`

同时修复 `permalink` 缺少 trailing slash：

```diff
- const permalink = `${Astro.site?.toString()}posts/${post.id}`;
+ const permalink = `${Astro.site?.toString()}posts/${post.id}/`;
```

### 3. `src/pages/index.astro` — 首页 SEO 数据

- description：使用 `sidebar.description` 的缩略版（前 160 字符）
- ogImage：使用默认 cover 图片的完整 URL
- ogType：不传，使用默认值 `"website"`

### 4. `src/pages/rss.xml.ts` — RSS Feed（新建）

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
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
    })),
  });
}
```

### 5. `public/robots.txt` — 新建

```
User-agent: *
Allow: /
Sitemap: https://blog.lflops.ovh/sitemap-index.xml
```

---

## 需要你手动做的事

1. 到 [Google Search Console](https://search.google.com/search-console) 添加 `blog.lflops.ovh` 并提交 sitemap：
   `https://blog.lflops.ovh/sitemap-index.xml`
2. 等待 1-4 周，谷歌逐步收录
3. 可以考虑用 `site:blog.lflops.ovh` 在 Google 搜索中查看已收录页面
