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
   */
  async onLogin() {
    const { phone, code } = this.data;
    if (!phone || !code) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await login({ phone, code });
      wx.setStorageSync('token', res.data.token);
      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/device-list/device-list' });
      }, 800);
    } catch (error) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
