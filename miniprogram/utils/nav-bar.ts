/**
 * 自定义导航栏尺寸：状态栏高度 + 与微信胶囊按钮垂直对齐的导航栏内容高度。
 * 老基础库或测试环境取不到胶囊信息时回退默认值，调用方仍可正常渲染。
 */
export const DEFAULT_STATUS_BAR_HEIGHT = 20;
export const DEFAULT_NAV_BAR_HEIGHT = 44;

export interface NavBarMetrics {
  statusBarHeight: number;
  navBarHeight: number;
}

export function readNavBarMetrics(): NavBarMetrics {
  let statusBarHeight = DEFAULT_STATUS_BAR_HEIGHT;
  let navBarHeight = DEFAULT_NAV_BAR_HEIGHT;

  try {
    const info = wx.getWindowInfo();
    if (typeof info?.statusBarHeight === "number") {
      statusBarHeight = info.statusBarHeight;
    }

    const menu = wx.getMenuButtonBoundingClientRect();
    if (menu && menu.top >= statusBarHeight && menu.height > 0) {
      navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    }
  } catch (error) {
    // 取不到胶囊信息时保留默认值
  }

  return { statusBarHeight, navBarHeight };
}
