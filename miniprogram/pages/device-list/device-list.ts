import { getDeviceList, getDeviceStatus, Device, DeviceStatus } from '../../api/api';

/** 设备展示项 = 基础信息 + 状态信息 */
interface DeviceDisplayItem extends Device {
  status?: DeviceStatus['status'];
  battery?: number;
  isCharging?: boolean;
  lastActiveAt?: string;
  statusLoading?: boolean;
}

/**
 * 设备列表页
 * 展示用户绑定的设备卡片，点击卡片进入控制面板。
 */
Page({
  data: {
    loading: true,
    devices: [] as DeviceDisplayItem[],
  },

  onLoad() {
    this.fetchDeviceList();
  },

  onShow() {
    // 每次显示页面时刷新列表，方便从控制页返回后看到最新状态
    this.fetchDeviceList();
  },

  /**
   * 拉取设备列表，并并发获取每个设备的状态/电量
   */
  async fetchDeviceList() {
    this.setData({ loading: true });
    try {
      const listRes = await getDeviceList();
      const devices: DeviceDisplayItem[] = listRes.data.map((device) => ({
        ...device,
        statusLoading: true,
      }));
      this.setData({ devices });

      // 并发获取每个设备的状态/电量
      await Promise.all(
        devices.map((device) => this.fetchDeviceStatus(device.id)),
      );
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 获取单个设备状态/电量
   */
  async fetchDeviceStatus(deviceId: string) {
    try {
      const res = await getDeviceStatus(deviceId);
      const statusData = res.data;
      const devices = this.data.devices.map((device) => {
        if (device.id !== deviceId) return device;
        return {
          ...device,
          status: statusData.status,
          battery: statusData.battery,
          isCharging: statusData.isCharging,
          lastActiveAt: statusData.lastActiveAt,
          statusLoading: false,
        };
      });
      this.setData({ devices });
    } catch (error) {
      // 单个设备状态获取失败，不影响其他设备
      const devices = this.data.devices.map((device) => {
        if (device.id !== deviceId) return device;
        return { ...device, statusLoading: false };
      });
      this.setData({ devices });
    }
  },

  /**
   * 查看对话：跳转对话记录页
   */
  onViewChat(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?id=${id}`,
    });
  },

  /**
   * 智能分析：跳转单设备智能分析页
   */
  onViewAnalysis(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-analysis/device-analysis?id=${id}`,
    });
  },

  /**
   * 设置入口：跳转设备设置页
   */
  onSettingsTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-setting/device-setting?id=${id}`,
    });
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.fetchDeviceList();
    wx.stopPullDownRefresh();
  },
});
