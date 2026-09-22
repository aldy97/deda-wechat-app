import { login } from '../../api/api';

/** Vant Field change 事件，detail 为当前输入值字符串 */
interface VantFieldChangeEvent {
  detail: string;
}

/**
 * 登录页
 * 提供手机号 + 验证码登录骨架，登录成功后跳转到设备列表。
 */
Page({
  data: {
    phone: '',
    code: '',
    loading: false,
    countdown: 0,
  },

  onLoad() {
    console.log('[Login] onLoad');
  },

  /**
   * 手机号输入
   */
  onPhoneChange(event: VantFieldChangeEvent) {
    this.setData({ phone: event.detail });
  },

  /**
   * 验证码输入
   */
  onCodeChange(event: VantFieldChangeEvent) {
    this.setData({ code: event.detail });
  },

  /**
   * 发送验证码（模拟）
   */
  onSendCode() {
    if (this.data.countdown > 0) return;

    wx.showToast({ title: '验证码已发送', icon: 'success' });
    this.setData({ countdown: 60 });

    const timer = setInterval(() => {
      this.setData({ countdown: this.data.countdown - 1 });
      if (this.data.countdown <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  },

  /**
   * 登录提交
   * 1. 调用 wx.login 获取微信临时 code
   * 2. 将 code 传给 deda-server 换取 JWT
   */
  async onLogin() {
    const { phone, code: smsCode } = this.data;
    if (!phone || !smsCode) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const wxLoginRes = await this.wxLogin();
      // 微信小程序登录只需要 wx.login 返回的 code，手机号仅用于页面展示/后续绑定
      const res = await login({ code: wxLoginRes.code });
      wx.setStorageSync('token', res.data.token);
      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/device-list/device-list' });
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      console.error('[Login] login failed:', error);
      wx.showToast({ title: message, icon: 'none' });
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
