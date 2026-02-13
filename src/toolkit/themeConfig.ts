import type { NavItemType } from "@/components/navbar/NavTypes";
import type { SidebarConfig } from "@/components/sidebar/SidebarTypes";
import type { Locale } from "@/i18n";

interface BrandConfig {
  /**
   * 网站标题。
   * - 显示在页面 Brand 区域
   * - 会与 logo 和 subtitle 组合显示
   */
  title?: string;

  /**
   * 网站副标题。
   * - 仅在首页时显示在标题下方
   * - 用于补充说明网站主题或特色
   */
  subtitle?: string;

  /**
   * Logo 符号。
   * - 显示在标题左侧
   * - 推荐使用 emoji（如 "✨"）或短文本
   * - 也可填写图片路径
   */
  logo?: string;
}

interface CoverConfig {
  /**
   * 是否显示封面图。
   * - true：显示页面顶部封面区域
   * - false：隐藏封面，页面从导航栏下方直接开始
   */
  enableCover?: boolean;

  /**
   * 是否预加载封面图。
   * - true：使用 <link rel="preload"> 提前加载封面图片，提升首屏性能
   * - false：按默认方式加载
   * - 建议大型图片或网络较慢时启用
   */
  enablePreload?: boolean;

  /**
   * 是否启用固定封面。
   * - true：优先使用 fixedCover
   * - false：忽略 fixedCover
   * - undefined：兼容旧配置（当 fixedCover 有值时视为启用）
   */
  enableFixedCover?: boolean;

  /**
   * 固定封面配置：
   * - 推荐填 Images.astro 的预设 key："cover-1" ~ "cover-6"（会走 Astro 静态导入与 <Image />）
   * - 也可填 public 路径或远程 URL（会使用 <img> 兜底渲染）
   */
  fixedCover?: string;

  /**
   * 是否使用渐变背景封面。
   * - true：使用必应 API 获取每日图片作为封面
   * - false：使用预设封面图片或轮播
   * - 启用后会覆盖固定封面设置
   */
  gradient?: boolean;

  /**
   * 文章导航是否使用渐变背景。
   * - true：文章页底部的上一篇/下一篇导航使用随机渐变色背景
   * - false：使用文章封面图
   */
  enableNextGradientCover?: boolean;
}

interface FooterConfig {
  /**
   * 网站成立年份。
   * - 用于显示版权信息："© 2025-2026"
   * - 不填则默认为当前年份
   */
  since?: number;

  /**
   * 页脚图标配置。
   */
  icon?: {
    /**
     * 图标名称（CSS 动画类名）。
     * - 建议值："sakura rotate"（旋转的樱花效果）
     */
    name?: string;

    /**
     * 图标颜色。
     * - 支持任意 CSS 颜色值（如 "#ffc0cb"、"pink"）
     */
    color?: string;
  };

  /**
   * 是否显示统计信息。
   * - true：显示文章总数、总字数、估计阅读时间等统计
   * - false：不显示统计
   */
  count?: boolean;

  /**
   * 是否显示 "Powered by" 信息。
   * - true：显示主题和框架的致谢信息
   * - false：不显示
   */
  powered?: boolean;

  /**
   * ICP 备案配置（中国大陆网站必需）。
   */
  icp?: {
    /**
     * 是否启用备案信息显示。
     */
    enable?: boolean;

    /**
     * 备案图标路径。
     * - 填写 public 目录下的路径（如 "/beian-icon.png"）
     */
    icon?: string;

    /**
     * ICP 备案号。
     * - 示例："津ICP备2022001375号"
     */
    icpnumber?: string;

    /**
     * 公安备案号。
     * - 示例："京公网安备 11010502001234号"
     */
    beian?: string;

    /**
     * 公安备案代码。
     * - 用于生成公安备案查询链接
     */
    recordcode?: string;
  };
}

interface WidgetsConfig {
  /**
   * 是否显示随机文章小部件。
   * - true：在页脚区域显示随机推荐的 10 篇文章
   * - false：不显示
   */
  randomPosts?: boolean;

  /**
   * 是否显示最新评论小部件。
   * - true：显示最新评论列表（需要配置 Waline 或 Twikoo 评论系统）
   * - false：不显示
   */
  recentComments?: boolean;
}

interface HomeConfig {
  /**
   * 首页精选分类。
   * - 用于首页展示特定分类的文章卡片
   */
  selectedCategories?: {
    /**
     * 分类名称。
     * - 必须与文章 frontmatter 中的 category 字段完全匹配
     * - 大小写敏感
     */
    name: string;

    /**
     * 分类封面图（可选）。
     * - 为该分类指定自定义封面图
     * - 可填写 public 路径或远程 URL
     */
    cover?: string;
  }[];

  /**
   * 首页分页：每页文章数量（不含置顶文章）。
   * - 默认为 10
   * - 置顶文章始终显示在首页第一页顶部，不占用分页配额
   */
  pageSize?: number;
}

export interface FriendLinkConfig {
  /** 站点地址 */
  url: string;
  /** 站点标题 */
  title: string;
  /** 站点描述 */
  desc: string;
  /** 作者或站点主理人 */
  author: string;
  /** 头像地址 */
  avatar: string;
  /** 主题色（可选，支持 CSS 颜色值或变量） */
  color?: string;
  /** 站点预览图（可选） */
  siteImage?: string;
}

interface FriendsConfig {
  /** 友链页面标题 */
  title?: string;
  /** 友链页面描述 */
  description?: string;
  /** 友链配置示例使用的头像（可选） */
  avatar?: string;
  /** 友链配置示例使用的主题色（可选） */
  color?: string;
  /** 友链配置示例使用的站点预览图（可选） */
  siteImage?: string;
  /** 友链列表 */
  links: FriendLinkConfig[];
}

/**
 * 协议类型
 * CC 4.0 系列：BY, BY-SA, BY-ND, BY-NC, BY-NC-SA, BY-NC-ND
 * 禁止转载：NOREPRINT
 */
export type LicenseType =
  | "CC-BY-4.0"
  | "CC-BY-SA-4.0"
  | "CC-BY-ND-4.0"
  | "CC-BY-NC-4.0"
  | "CC-BY-NC-SA-4.0"
  | "CC-BY-NC-ND-4.0"
  | "NOREPRINT";

interface CopyrightConfig {
  /** 全站默认协议类型 */
  license?: LicenseType;
  /** 是否显示版权声明 */
  show?: boolean;
}

export interface ShokaXThemeConfig {
  /**
   * 网站名称。
   * - 用于 SEO、文章页标题等位置
   * - 与 brand.title 可以不同（brand.title 用于页面显示）
   */
  siteName: string;

  /**
   * 网站语言设置。
   * - "zh-CN"：简体中文
   * - "en"：英文
   * - 默认为 "zh-CN"
   */
  locale?: Locale;

  /**
   * 导航栏配置。
   * - 定义顶部导航栏的菜单项
   * - 支持链接、下拉菜单等类型
   */
  nav: NavItemType[];

  /**
   * 侧边栏配置。
   * - 包含作者信息、简介、社交链接、菜单等
   */
  sidebar?: SidebarConfig;

  /**
   * 品牌区配置。
   * - 包含网站标题、副标题、Logo 等
   */
  brand?: BrandConfig;

  /**
   * 封面配置。
   * - 控制页面顶部封面图的显示方式和样式
   */
  cover?: CoverConfig;

  /**
   * 页脚配置。
   * - 包含版权信息、统计数据、备案信息等
   */
  footer?: FooterConfig;

  /**
   * 小部件配置。
   * - 控制随机文章、最新评论等功能模块的显示
   */
  widgets?: WidgetsConfig;

  /**
   * 首页配置。
   * - 包含精选分类、分页设置等首页特定配置
   */
  home?: HomeConfig;

  /**
   * 版权配置。
   * - 设置文章默认许可协议和版权声明显示
   */
  copyright?: CopyrightConfig;

  /**
   * 友链配置。
   * - 定义友链页面展示的卡片数据
   */
  friends?: FriendsConfig;
}

export function defineConfig(config: ShokaXThemeConfig) {
  return config;
}
