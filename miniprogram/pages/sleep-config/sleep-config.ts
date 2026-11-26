import {
  DEFAULT_NAV_BAR_HEIGHT,
  DEFAULT_STATUS_BAR_HEIGHT,
  readNavBarMetrics,
} from "../../utils/nav-bar";

/**
 * 哄睡配置页（绑定完成后的日常修改入口）。
 *
 * 顶部 hero 背景图走远端展示位 sleep-config/hero-bg，未命中时透出渐变兜底；
 * 页面隐藏系统导航栏，背景图顶到状态栏，只保留返回键；
 * 配置表单与首次绑定页共用 components/sleep-config-form。
 */
Page({
  data: {
    deviceId: "",
    /** hero 下方的哄睡能力标签（仅展示，不可点） */
    heroTags: ["心理共鸣", "Kid Affirmation", "脑波调节"],
    /** 自定义导航栏：状态栏高度（px） */
    statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
    /** 自定义导航栏：导航栏内容高度（px），与微信胶囊按钮垂直对齐 */
    navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId, ...readNavBarMetrics() });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备信息", icon: "none" });
    }
  },

  /**
   * 返回上一页；直接从页面路径进入（无页面栈）时回设备列表
   */
  onBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: "/pages/device-list/device-list" });
      },
    });
  },
});
