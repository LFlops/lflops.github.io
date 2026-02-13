export interface NavItemType {
  /**
   * 导航项的链接地址。
   * - 可以是站内路径（如 "/"、"/posts/"）
   * - 也可以是站外 URL
   * - 对于下拉菜单来说，这是父级菜单的链接
   */
  href: string;

  /**
   * 导航项显示的文本。
   * - 在顶部导航栏中显示
   * - 支持中英文
   */
  text: string;

  /**
   * 导航项图标。
   * - 使用 Iconify Remix Icon 格式：如 "i-ri-home-line"
   * - 可选，不填则只显示文本
   * - 图标会显示在文本左侧
   */
  icon?: string;

  /**
   * 是否为下拉菜单。
   * - true：此项为下拉菜单，包含子菜单项
   * - false 或 undefined：普通导航链接
   * - 启用时需配合 dropboxItems 使用
   */
  dropbox?: boolean;

  /**
   * 下拉菜单的子菜单项。
   * - 仅当 dropbox 为 true 时有效
   * - 每个子项也是一个 NavItemType，但通常不再包含下拉菜单
   */
  dropboxItems?: NavItemType[];
}
