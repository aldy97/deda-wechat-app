import { login } from './api/api';
import { request } from './utils/request';

/**
 * 调用微信登录获取 code
 */
function wxLogin(): Promise<WechatMiniprogram.LoginSuccessCallbackResult> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });
}

/**
 * 静默登录：自动获取微信 code 并换取服务端 JWT token
 */
async function silentLogin() {
  const existingToken = wx.getStorageSync('token');
  if (existingToken) {
    console.log('[App] token already exists, skip silent login');
    return;
  }

  try {
    const wxLoginRes = await wxLogin();
    const res = await login({ code: wxLoginRes.code });
    wx.setStorageSync('token', res.data.token);
    console.log('[App] silent login success');
  } catch (error) {
    console.error('[App] silent login failed:', error);
  }
}

/**
 * 连通性检查：调用 /health 确认服务端可达
 */
async function checkServerHealth() {
  try {
    const res = await request<{ status: string }>({
      method: 'GET',
      url: '/health',
    });
    console.log('[App] server health:', res.data);
  } catch (error) {
    console.error('[App] server health check failed:', error);
  }
}

/**
 * 小程序全局入口
 * 联调阶段采用静默登录：启动时自动获取 wx.login code 并换取 JWT token，
 * 避免显示手机号验证码登录页，同时保证后续受保护接口能正常访问。
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
    console.log('[App] onLaunch');
    checkServerHealth();
    silentLogin();
  },

  onShow() {
    console.log('[App] onShow');
  },

  onHide() {
    console.log('[App] onHide');
  },
});
