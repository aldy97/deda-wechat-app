/**
 * 我的页面：提供孩子列表与用户反馈入口，其余入口保持静态。
 */
Page({
  data: {
    /** 用户手机号 */
    phone: "18016235670",
    /** 孩子昵称 */
    childName: "熊熊",
  },

  onChildListTap() {
    wx.navigateTo({ url: "/pages/child-list/child-list" });
  },

  onFeedbackTap() {
    wx.navigateTo({ url: "/pages/feedback/feedback" });
  },
});
