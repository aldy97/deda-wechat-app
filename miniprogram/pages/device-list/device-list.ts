import { getDeviceStatus, Device, DeviceStatus } from '../../api/api';

/** 本地联调样机 DEV001，固定写入设备列表，便于跳过绑定步骤直接验证对话链路 */
const DEV001_DEVICE: Device = {
  id: 'dev-local-001',
  name: 'DEV001（联调样机）',
  deviceId: 'dev-local-001',
  deviceCode: 'DEV001',
  networkType: '4G',
};

/** 设备展示项 = 基础信息 + 状态信息 */
interface DeviceDisplayItem extends Device {
  status?: DeviceStatus['status'];
  battery?: number;
  isCharging?: boolean;
  lastActiveAt?: string;
  statusLoading?: boolean;
}

/**
 * 设备列表页（联调简化版）
 * 仅固定展示 DEV001 一个设备，用于快速验证对话链路。
 */
Page({
  data: {
    loading: true,
    devices: [] as DeviceDisplayItem[],
  },

  onLoad() {
    this.checkLoginAndLoad();
  },

  onShow() {
    this.checkLoginAndLoad();
  },

  /**
   * 检查登录态，未登录则跳登录页
   */
  checkLoginAndLoad() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.loadDeviceList();
  },

  /**
   * 加载设备列表：固定只展示 DEV001
   */
  async loadDeviceList() {
    this.setData({ loading: true });

    const device: DeviceDisplayItem = {
      ...DEV001_DEVICE,
      statusLoading: true,
    };

    try {
      const status = await this.fetchDeviceStatus(device.id);
      device.status = status.status;
      device.battery = status.battery;
      device.isCharging = status.isCharging;
      device.lastActiveAt = status.lastActiveAt;
    } catch (error) {
      // 状态获取失败不影响设备展示
      device.status = 'offline';
      device.battery = 0;
      device.isCharging = false;
    } finally {
      device.statusLoading = false;
    }

    this.setData({ devices: [device], loading: false });
  },

  /**
   * 获取单个设备状态/电量
   * @param deviceId 设备 ID
   * @returns 设备状态数据，失败时返回离线默认值
   */
  async fetchDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    try {
      const res = await getDeviceStatus(deviceId);
      return res.data;
    } catch (error) {
      return {
        deviceId,
        status: 'offline',
        battery: 0,
        isCharging: false,
        lastActiveAt: '',
      };
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

  // /**
  //  * 添加设备：跳转绑定页（联调阶段注释掉，固定只展示 DEV001）
  //  */
  // onBindDevice() {
  //   wx.navigateTo({
  //     url: '/pages/device-bind/device-bind',
  //   });
  // },

  /**
   * 切换模式：跳转切换模式页
   */
  onSwitchMode(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/switch-mode/switch-mode?id=${id}`,
    });
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.loadDeviceList();
    wx.stopPullDownRefresh();
  },
});
