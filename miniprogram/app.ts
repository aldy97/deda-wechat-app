import { request } from "./utils/request";
import { ensureAuthToken } from "./api/api";

/**
 * 连通性检查：调用 /health 确认服务端可达
 */
async function checkServerHealth() {
  try {
    const res = await request<{ status: string }>({
      method: "GET",
      url: "/health",
    });
    console.log("[App] server health:", res.data);
  } catch (error) {
    console.error("[App] server health check failed:", error);
  }
}

/**
 * 小程序全局入口
 * 首屏即设备列表；token 缺失时由 ensureAuthToken 静默换取（wx.login → JWT），
 * 登录页仅作为 wx.login 失败/401 时的兜底。
 */
App<{
  globalData: {
    userInfo: null;
  };
}>({
  globalData: {
    // 全局用户信息占位，登录成功后可在各页面读取
    userInfo: null,
  },

  onLaunch() {
    console.log("[App] onLaunch");
    checkServerHealth();

    // 预热静默登录：token 缺失时后台换取，页面请求经 ensureAuthToken 自动等待
    ensureAuthToken().catch((error) => {
      console.warn("[App] silent auth warm-up failed:", error);
    });
  },

  onShow() {
    console.log("[App] onShow");
  },

  onHide() {
    console.log("[App] onHide");
  },
});
