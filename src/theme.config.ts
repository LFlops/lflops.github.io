// cannot use path alias here because unocss can not resolve it
import { defineConfig } from "./toolkit/themeConfig";

export default defineConfig({
  // 基本信息
  siteName: "lflops.ovh",           // 站点名称
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
    title: "lflops",                // 品牌标题
    subtitle: "SRE by day, Anime enthusiast by night.",           // 副标题
    logo: "✨",                       // Logo 图标
  },

  // 封面配置
  cover: {
    enableCover: true,               // 启用封面
    enablePreload: true,             // 预加载封面
    enableFixedCover: false,         // 启用固定封面
    // fixedCover: "cover-1",        // 固定封面图片
    gradient: false,                  // 渐变模式
  },

  // 侧边栏配置
  sidebar: {
    author: "LFlops",               // 作者名
    description: "💻 SRE by day, Anime enthusiast by night. ☕ Java | 🐍 Python | 🦀 Rust | 🐹 Go (Learning) ☁️ Cloud Native & DevOps Advocate.",          // 简介文字
    social: {                        // 社交媒体链接
      github: {
        url: "https://github.com/LFlops",
        icon: "i-ri-github-fill",
      },
      twitter: {
        url: "https://twitter.com/LFlops77",
        icon: "i-ri-twitter-x-line",
      },
      email: {
        url: "mailto:lflops77@gamil.com",
        icon: "i-ri-mail-line",
      },
    },
  },

  // 页脚配置
  footer: {
    since: 2026,                     // 建站年份
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
    ],
  },

  // 版权配置
  copyright: {
    license: "CC-BY-NC-SA-4.0",      // 默认版权协议
    show: true,                      // 显示版权声明
  },
});