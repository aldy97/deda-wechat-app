import { bindDevice } from '../../api/api';

/** Vant Field change 事件，detail 为当前输入值字符串 */
interface VantFieldChangeEvent {
  detail: string;
}

/**
 * 绑定设备页
 * 家长输入设备编码（deviceCode）完成绑定。
 */
Page({
  data: {
    deviceCode: '',
    loading: false,
  },

  onLoad() {
    console.log('[DeviceBind] onLoad');
  },

  /**
   * 设备编码输入
   */
  onCodeChange(event: VantFieldChangeEvent) {
    this.setData({ deviceCode: event.detail });
  },

  /**
   * 提交绑定
   */
  async onBind() {
    const { deviceCode } = this.data;
    if (!deviceCode.trim()) {
      wx.showToast({ title: '请输入设备编码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await bindDevice(deviceCode.trim());
      wx.showToast({
        title: res.data.alreadyBound ? '设备已绑定' : '绑定成功',
        icon: 'success',
      });

      // 清除设备列表缓存，确保返回后重新拉取
      try {
        wx.removeStorageSync('device_list_cache');
      } catch (e) {
        // ignore
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : '绑定失败';
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
