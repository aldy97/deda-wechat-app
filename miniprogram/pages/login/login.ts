import { login } from "../../api/api";
import { reportClientInfoIfNeeded } from "../../utils/client-info";

/**
 * 登录页
 * 微信静默登录：wx.login 换取临时 code → deda-server jscode2session 换 openid → JWT。
 * 官方推荐的用户体系建立方式（openid 即用户标识），无需手机号/验证码。
 * 开发环境说明：未配置真实微信凭证时，后端模拟 jscode2session 返回稳定 openid，便于联调。
 */
Page({
  data: {
    loading: false,
  },

  onLoad() {
    console.log("[Login] onLoad");
  },

  /**
   * 登录提交
   * 1. 调用 wx.login 获取微信临时 code
   * 2. 将 code 传给 deda-server 换取 JWT
   */
  async onLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });
    try {
      const wxLoginRes = await this.wxLogin();
      const res = await login({ code: wxLoginRes.code });
      wx.setStorageSync("token", res.data.token);
      void reportClientInfoIfNeeded();
      wx.showToast({ title: "登录成功", icon: "success" });

      setTimeout(() => {
        wx.switchTab({ url: "/pages/device-list/device-list" });
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      console.error("[Login] login failed:", error);
      wx.showToast({ title: message, icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 调用微信登录获取 code
   */
  wxLogin(): Promise<WechatMiniprogram.LoginSuccessCallbackResult> {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject,
      });
    });
  },
});
