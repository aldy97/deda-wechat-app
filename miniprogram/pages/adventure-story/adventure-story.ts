import {
  DEFAULT_NAV_BAR_HEIGHT,
  DEFAULT_STATUS_BAR_HEIGHT,
  readNavBarMetrics,
} from "../../utils/nav-bar";

/**
 * 冒险故事介绍页。
 *
 * 入口：设备列表「冒险故事」入口卡。
 * hero 背景图顶到状态栏，页面隐藏系统导航栏，只保留叠在 hero 上的返回键；
 * 顶部背景图走远端展示位 adventure-story/hero-bg，未命中时透出渐变兜底；
 * 本期只承载每日一集的玩法说明与只读的「每日冒险」状态；总开关等
 * deda-server 的 adventure-configs 接口就绪后再接入，不在前端做假开关。
 */
Page({
  data: {
    /** 当前设备业务 id；由设备列表入口带入，供后续配置接口使用 */
    deviceId: "",
    /** 自定义导航栏：状态栏高度（px） */
    statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
    /** 自定义导航栏：导航栏内容高度（px），与微信胶囊按钮垂直对齐 */
    navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    /** hero 高度（rpx）：按背景图原始宽高比计算，未加载时用设计稿兜底值 */
    heroHeight: 440,
    /** 页头标题与副标题 */
    heroTitle: "和 Elly 一起去冒险",
    heroSubtitle: "每天一集，孩子做选择，故事往前走",
    /** 玩法说明：与服务端每日门禁、跨天续玩、星光奖励的实际行为对齐 */
    sections: [
      {
        title: "每天只安排一集",
        body: "今天的冒险完成后，Elly 会把故事收好，明天再出发；没听完的一集，第二天还能接着玩。",
      },
      {
        title: "孩子做选择，故事向前走",
        body: "故事会停在选择点，孩子说出自己的想法，Elly 接住他的话，再继续讲下去。不催、不纠正。",
      },
      {
        title: "一起收集星光",
        body: "每完成一集，孩子和 Elly 就多一颗星星；第二天的冒险，会从昨天的地方继续。",
      },
    ],
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
   * 科学原理 banner：进入冒险故事模式介绍页
   */
  onOpenAdventureScience() {
    wx.navigateTo({
      url: "/pages/adventure-story-mode/adventure-story-mode",
    });
  },
});
