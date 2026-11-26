/**
 * 哄睡配置页（绑定完成后的日常修改入口）。
 *
 * 顶部 hero 背景图走远端展示位 sleep-config/hero-bg，未命中时透出渐变兜底；
 * 配置表单与首次绑定页共用 components/sleep-config-form。
 */
Page({
  data: {
    deviceId: "",
    /** hero 下方的哄睡能力标签（仅展示，不可点） */
    heroTags: ["心理共鸣", "Kid Affirmation", "脑波调节"],
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备信息", icon: "none" });
    }
  },
});
