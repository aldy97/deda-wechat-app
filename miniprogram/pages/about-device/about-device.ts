import { getDeviceAboutInfo, DeviceAboutInfo } from '../../api/api';

/**
 * 关于设备页
 * 展示设备编码、网络、固件等详细信息。
 * 点击设备编码可复制到剪贴板。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    info: {} as DeviceAboutInfo,
    /** 复制成功提示显示状态 */
    showCopyToast: false,
  },

  /** 提示隐藏定时器 */
  copyToastTimer: null as number | null,

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.fetchDeviceAboutInfo(deviceId);
  },

  onUnload() {
    if (this.copyToastTimer) {
      clearTimeout(this.copyToastTimer);
    }
  },

  /**
   * 获取关于设备信息
   */
  async fetchDeviceAboutInfo(deviceId: string) {
    this.setData({ loading: true });
    try {
      const res = await getDeviceAboutInfo(deviceId);
      this.setData({ info: res.data });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 点击设备编码：复制到剪贴板
   */
  onCopyDeviceCode() {
    const { deviceCode } = this.data.info;
    if (!deviceCode) return;

    wx.setClipboardData({
      data: deviceCode,
      success: () => {
        this.showCopySuccessToast();
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      },
    });
  },

  /**
   * 显示复制成功提示，3 秒后淡出隐藏
   */
  showCopySuccessToast() {
    if (this.copyToastTimer) {
      clearTimeout(this.copyToastTimer);
    }

    this.setData({ showCopyToast: true });

    this.copyToastTimer = setTimeout(() => {
      this.setData({ showCopyToast: false });
    }, 3000);
  },
});
