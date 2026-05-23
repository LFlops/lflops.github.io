# Astro Blog ShokaX 个人博客配置指南

基于 Astro Blog ShokaX 主题构建个人博客的完整配置和部署指南。

## 1. 项目概述

Astro Blog ShokaX 是一个使用 **Astro + Svelte 5 + UnoCSS** 技术的现代博客主题，具有以下特点：

- **支持 MDX**：丰富的 Markdown 扩展功能
- **多语言支持**：内置中英文翻译
- **搜索功能**：集成 Pagefind 全文搜索
- **响应式设计**：适配移动端和桌面端
- **主题配置**：通过配置文件轻松自定义
- **性能优化**：静态生成，加载速度快

### 关键文件结构
```
├── src/theme.config.ts          # 主配置文件
├── astro.config.mjs            # Astro 构建配置
├── src/content.config.ts       # 文章集合定义
├── src/i18n/                  # 多语言翻译文件
├── src/posts/                 # 博客文章目录
├── src/assets/                # 静态资源（头像、封面等）
├── src/layouts/              # 布局组件
└── src/components/           # 可复用组件
```

## 2. 安装与运行

### 2.1 环境要求
- [Bun](https://bun.sh/) 1.3.6+（推荐）
- Node.js 18+（备选）

### 2.2 安装依赖
```bash
# 使用 Bun（推荐）
bun install

# 或使用 npm
npm install
```

### 2.3 开发与构建
```bash
# 启动开发服务器（热重载）
bun run dev

# 构建生产版本
bun run build

# 预览构建结果
bun run preview

# 代码质量检查
bun run lint     # 代码检查
bun run format   # 代码格式化
bun run check    # TypeScript 类型检查
```

## 3. 个性化配置

### 3.1 修改主题配置 (`src/theme.config.ts`)

这是最重要的配置文件，需要更新以下字段：

```typescript
export default defineConfig({
  // 基本信息
  siteName: "你的博客名称",           // 站点名称
  locale: "zh-CN",                    // 语言：zh-CN 或 en

  // 导航菜单配置
  nav: [
    {
      href: "/",
      text: "首页",
      icon: "i-ri-home-line",
    },
    {
      dropbox: true,
      text: "文章",
      href: "/posts/",
      icon: "i-ri-quill-pen-fill",
      dropboxItems: [
        {
          href: "/categories/",
          text: "分类",
          icon: "i-ri-book-shelf-fill",
        },
        {
          href: "/tags/",
          text: "标签",
          icon: "i-ri-price-tag-3-fill",
        },
        {
          href: "/archives/",
          text: "归档",
          icon: "i-ri-archive-line",
        },
      ],
    },
    {
      text: "友链",
      href: "/friends/",
      icon: "i-ri-link",
    },
  ],

  // 品牌信息
  brand: {
    title: "你的名字",                // 品牌标题
    subtitle: "一句话介绍",           // 副标题
    logo: "✨",                       // Logo 图标
  },

  // 封面配置
  cover: {
    enableCover: true,               // 启用封面
    enablePreload: true,             // 预加载封面
    enableFixedCover: false,         // 启用固定封面
    // fixedCover: "cover-1",        // 固定封面图片
    gradient: true,                  // 渐变模式
  },

  // 侧边栏配置
  sidebar: {
    author: "你的名字",               // 作者名
    description: "个人简介",          // 简介文字
    social: {                        // 社交媒体链接
      github: {
        url: "https://github.com/你的用户名",
        icon: "i-ri-github-fill",
      },
      twitter: {
        url: "https://twitter.com/你的用户名",
        icon: "i-ri-twitter-x-line",
      },
      email: {
        url: "mailto:你的邮箱",
        icon: "i-ri-mail-line",
      },
    },
  },

  // 页脚配置
  footer: {
    since: 2025,                     // 建站年份
    icon: {
      name: "sakura rotate",
      color: "#ffc0cb",
    },
    count: true,                     // 显示文章统计
    powered: true,                   // 显示 "Powered by"
    icp: {
      enable: false,                 // 如需备案则设为 true
      icpnumber: "你的备案号",        // 备案号
      // beian: "网安备案号",        // 网安备案号
    },
  },

  // 小工具配置
  widgets: {
    randomPosts: true,               // 随机文章
    recentComments: true,            // 最近评论
  },

  // 首页配置
  home: {
    selectedCategories: [{ name: "Tutorial" }, { name: "Frontend" }],
    pageSize: 5,                     // 每页文章数
  },

  // 友链页面配置
  friends: {
    title: "友链",
    description: "卡片式展示，支持站点预览与主题色点缀。",
    links: [
      {
        url: "https://example.com",
        title: "朋友站点",
        desc: "站点描述",
        author: "作者名",
        avatar: "https://example.com/avatar.png",
        color: "var(--color-blue)",
      },
    ],
  },

  // 版权配置
  copyright: {
    license: "CC-BY-NC-SA-4.0",      // 默认版权协议
    show: true,                      // 显示版权声明
  },
});
```

### 3.2 更新翻译文件（如需多语言支持）

- **中文翻译**：`src/i18n/locales/zh-CN.json`
- **英文翻译**：`src/i18n/locales/en.json`

如需添加其他语言，请在 `src/i18n/index.ts` 中注册新语言。

### 3.3 替换头像和封面图片

**重要提示**：默认头像和封面图片有版权限制，必须替换为自有版权的素材。

1. **头像图片**：
   - 路径：`src/assets/avatar.avif`
   - 推荐尺寸：200×200px
   - 格式：AVIF、WebP、PNG 或 JPG

2. **封面图片**：
   - 路径：`src/assets/images/cover-1.avif` 到 `cover-6.avif`
   - 推荐尺寸：1920×1080px
   - 数量：6张（用于封面轮播）

3. **配置固定封面**（可选）：
   ```typescript
   cover: {
     enableFixedCover: true,
     fixedCover: "cover-1",  // 使用预设图片
     // 或使用外部 URL
     // fixedCover: "https://example.com/your-cover.jpg",
   }
   ```

### 3.4 更新站点 URL（部署前必须修改）

修改 `astro.config.mjs` 第 38 行：
```javascript
export default defineConfig({
  site: "https://你的域名.com",  // 改为你的实际域名
  // 例如：
  // site: "https://username.github.io",
  // site: "https://blog.example.com",
  // ...
});
```

## 4. 添加博客文章

### 4.1 文章目录结构
```
src/posts/
├── hello-world.md          # 示例文章
├── getting-started.md      # 入门指南
├── customizing-theme.md    # 主题定制
└── note-mdx-demo.mdx      # MDX 演示
```

### 4.2 文章 Frontmatter 格式

```markdown
---
title: "文章标题"
description: "文章描述"
date: 2025-01-01
updated: 2025-01-02                # 更新日期（可选）
tags: ["标签1", "标签2"]           # 标签
categories: ["分类"]               # 分类
draft: false                       # 草稿模式（true 时不显示）
cover: "cover-1"                   # 封面图片（可选）
sticky: false                      # 置顶文章（可选）
license: "CC-BY-NC-SA-4.0"         # 版权协议（可选）
---

# 文章标题

文章内容...

## 二级标题

支持 Markdown 和 MDX 语法：

- **粗体**、*斜体*
- 代码块：\`\`\`javascript
- 数学公式：$E = mc^2$
- 表格、任务列表等
```

### 4.3 支持的内容特性

- **数学公式**：通过 KaTeX 支持
- **图表**：支持 Mermaid（需自行集成）
- **代码高亮**：使用 Shiki，支持多种主题
- **自定义组件**：支持 MDX 组件
- **脚注、上标、下标**：通过 remark 插件支持

## 5. 自定义样式（可选）

### 5.1 全局样式文件
- `src/styles/style.css` - 全局样式
- `src/styles/palette.css` - 主题色配置
- `src/styles/spoiler.css` - 折叠内容样式

### 5.2 UnoCSS 配置
如需添加自定义原子类，修改 `uno.config.ts`：
```typescript
import { defineConfig } from 'unocss'

export default defineConfig({
  // 扩展预设或添加自定义规则
  rules: [
    // 自定义规则
  ],
})
```

### 5.3 修改主题色
在 `src/styles/palette.css` 中修改 CSS 变量：
```css
:root {
  --color-primary: #007acc;      /* 主色调 */
  --color-secondary: #6c757d;    /* 副色调 */
  /* 其他颜色变量... */
}
```

## 6. 部署选项

### 6.1 Vercel（推荐）
项目已包含 `vercel.json` 配置，可直接导入仓库：

1. 登录 [Vercel](https://vercel.com)
2. 点击 "Add New Project" → "Import Git Repository"
3. 选择你的仓库，保持默认配置
4. 点击 "Deploy"

### 6.2 Netlify
项目已包含 `netlify.toml` 配置：

1. 登录 [Netlify](https://netlify.com)
2. 点击 "Add new site" → "Import an existing project"
3. 选择你的 Git 仓库
4. 构建命令：`bun run build`
5. 发布目录：`dist`

### 6.3 GitHub Pages
需要修改构建配置：

1. 在 `astro.config.mjs` 中设置：
   ```javascript
   site: "https://用户名.github.io/仓库名"
   ```

2. 创建 GitHub Actions 工作流（`.github/workflows/deploy.yml`）：
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v1
         - run: bun install
         - run: bun run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

### 6.4 自定义服务器
构建后的 `dist/` 目录为静态文件，可部署到：

- **Nginx/Apache**：配置静态文件服务
- **云存储**：AWS S3、Google Cloud Storage、阿里云 OSS 等
- **CDN**：Cloudflare、腾讯云 CDN 等

## 7. 其他建议

### 7.1 开发工具推荐
- **编辑器**：VS Code
  - 安装 Astro 官方扩展
  - 安装 Svelte for VS Code
  - 安装 UnoCSS 扩展
- **浏览器扩展**：React Developer Tools（支持 Svelte 5）

### 7.2 功能扩展建议

#### 评论系统
集成 Giscus（GitHub Discussions）：
1. 在 GitHub 仓库启用 Discussions
2. 获取仓库 ID 和分类
3. 添加 Giscus 组件到文章布局

#### 分析统计
添加 Google Analytics 或 Umami：
```html
<!-- 在布局的 <head> 中添加 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

#### RSS 订阅
已集成 `@astrojs/rss`，访问 `/rss.xml` 即可获取。

### 7.3 性能优化
- **图片优化**：使用 `.avif` 或 `.webp` 格式
- **字体子集化**：自动对中文字体进行子集化
- **代码分割**：Astro 自动进行
- **预加载**：封面图片可预加载

### 7.4 安全配置
已包含的安全头：
- `Content-Security-Policy: frame-ancestors 'none';`
- `X-Frame-Options: DENY`
- 静态资源长期缓存

## 8. 快速检查清单

### 配置检查
- [ ] 修改 `src/theme.config.ts` 中的站点信息
- [ ] 替换头像 (`src/assets/avatar.avif`)
- [ ] 替换封面图片 (`src/assets/images/cover-*.avif`)
- [ ] 更新 `astro.config.mjs` 中的 `site` URL
- [ ] 检查翻译文件是否需要更新

### 内容准备
- [ ] 添加个人简介到 `sidebar.description`
- [ ] 添加社交媒体链接到 `sidebar.social`
- [ ] 准备至少一篇博客文章到 `src/posts/`
- [ ] 配置友链页面（如需）

### 开发测试
- [ ] 运行 `bun run dev` 测试开发服务器
- [ ] 运行 `bun run build` 测试构建
- [ ] 运行 `bun run preview` 预览构建结果
- [ ] 运行 `bun run lint` 和 `bun run check` 检查代码质量

### 部署准备
- [ ] 选择部署平台（Vercel/Netlify/GitHub Pages）
- [ ] 配置自定义域名（如需）
- [ ] 设置环境变量（如需）
- [ ] 配置 HTTPS/SSL

## 9. 常见问题

### 9.1 构建失败
- **错误**：`Cannot find module`
  - 解决方案：运行 `bun install` 重新安装依赖
- **错误**：`TypeScript 类型错误`
  - 解决方案：运行 `bun run check` 检查类型，修复错误

### 9.2 图片不显示
- 检查图片路径是否正确
- 确认图片格式受支持（AVIF、WebP、PNG、JPG）
- 检查图片文件权限

### 9.3 搜索功能无效
- 确保运行 `bun run build` 时包含 `bun run build:index`
- 检查 `dist/pagefind` 目录是否存在

### 9.4 样式问题
- 检查 UnoCSS 是否正常加载
- 查看浏览器控制台是否有 CSS 错误
- 确认自定义样式文件路径正确

## 10. 获取帮助

- **官方文档**：[Astro 文档](https://docs.astro.build)
- **主题仓库**：[Astro Blog ShokaX](https://github.com/theme-shoka-x/astro-blog-shokax)
- **问题反馈**：在 GitHub 仓库创建 Issue
- **社区支持**：Astro Discord 社区

---

**最后更新**：2025-01-01
**适用版本**：Astro Blog ShokaX v0.0.1
**维护者**：ShokaX 开发团队