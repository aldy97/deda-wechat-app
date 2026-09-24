import { request } from './utils/request';

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
 * 已登录用户直接进入设备列表；未登录用户留在登录页走 wx.login 流程。
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

    const token = wx.getStorageSync('token');
    if (token) {
      console.log('[App] token exists, redirect to device list');
      wx.switchTab({ url: '/pages/device-list/device-list' });
    } else {
      console.log('[App] no token, stay on login page');
    }
  },

  onShow() {
    console.log('[App] onShow');
  },

  onHide() {
    console.log('[App] onHide');
  },
});
