/**
 * 小程序全局入口
 * 仅保留最基础的生命周期与全局数据，方便后续扩展登录态、设备信息等。
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
    // 小程序启动时执行，可在此检查登录态、获取系统信息等
    console.log('[App] onLaunch');
    this.checkLoginStatus();
  },

  /**
   * 检查登录态：无 token 则跳转到登录页
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  onShow() {
    console.log('[App] onShow');
  },

  onHide() {
    console.log('[App] onHide');
  },
});
