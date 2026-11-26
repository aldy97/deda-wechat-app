/**
 * 哄睡管理页（家长 onboarding 首次绑定专用）。
 *
 * 配置表单由 components/sleep-config-form 承载，与后续修改页（sleep-config）
 * 共用同一份实现；本页只负责绑定引导的页头气泡与「完成」入口。
 */
Page({
  data: {
    deviceId: "",
    /** 是否来自绑定引导流程（末尾展示完成入口，完成后回我的设备） */
    fromBind: false,
    /** 页头气泡文案（仅在绑定引导流程展示） */
    bubbleLines: [
      "请设置宝贝的常规睡眠时间吧～",
      "DEDA听风原野的小居民会用温柔的声音讲故事，陪伴宝贝慢慢入睡",
    ],
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    const fromBind = options?.from === "bind";
    this.setData({ deviceId, fromBind });
  },

  /** 绑定引导流程完成：回我的设备列表 */
  onFinish() {
    wx.switchTab({ url: "/pages/device-list/device-list" });
  },
});
