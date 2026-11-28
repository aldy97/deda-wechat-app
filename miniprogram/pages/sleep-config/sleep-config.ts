import {
  DEFAULT_NAV_BAR_HEIGHT,
  DEFAULT_STATUS_BAR_HEIGHT,
  readNavBarMetrics,
} from "../../utils/nav-bar";
import { EMPTY_HERO_HEIGHT_RPX } from "../../constants/hero";

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
    /** hero 高度（rpx）：按背景图原始宽高比计算，未加载时用设计稿兜底值 */
    heroHeight: 440,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId, ...readNavBarMetrics() });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备信息", icon: "none" });
    }
  },

  /**
   * 背景图加载完成：按图片原始比例换算 hero 高度（750rpx = 屏幕宽度），
   * 首帧兜底 440rpx，避免图片未就绪时版式跳动。
   */
  onHeroImageLoad(event: WechatMiniprogram.CustomEvent) {
    const detail = event?.detail;
    const width = detail?.width;
    const height = detail?.height;
    if (!width || !height) return;
    const heroHeight = Math.round((750 * height) / width);
    if (heroHeight > 0 && heroHeight !== this.data.heroHeight) {
      this.setData({ heroHeight });
    }
  },

  /**
   * 背景图最终拿不到（展示位未命中 / 加载失败）：把 hero 收窄到导航安全区，
   * 不再留 440rpx 空白。
   */
  onHeroUnavailable() {
    this.setData({ heroHeight: EMPTY_HERO_HEIGHT_RPX });
  },

  /**
   * 进入晚安故事模式介绍页
   */
  onOpenScience() {
    wx.navigateTo({ url: "/pages/night-story-intro/night-story-intro" });
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
