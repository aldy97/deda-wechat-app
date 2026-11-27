/**
 * 冒险故事介绍页。
 *
 * 入口：设备列表「冒险故事」入口卡。
 * 本期只承载每日一集的玩法说明与只读的「每日冒险」状态；总开关等
 * deda-server 的 adventure-configs 接口就绪后再接入，不在前端做假开关。
 */
Page({
  data: {
    /** 当前设备业务 id；由设备列表入口带入，供后续配置接口使用 */
    deviceId: "",
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
    this.setData({ deviceId });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备信息", icon: "none" });
    }
  },
});
