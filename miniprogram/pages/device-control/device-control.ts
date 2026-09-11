import { getDeviceControl, updateDeviceControl, DeviceControlData } from '../../api/api';

/** Vant 组件 change 事件，detail 为当前值 */
interface VantBooleanEvent { detail: boolean; }
interface VantNumberEvent { detail: number; }
interface VantStringEvent { detail: string; }

/**
 * 设备控制面板页
 * 展示设备开关、音量、模式等控制项，所有操作调用模拟接口。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    device: {} as DeviceControlData,
  },

  onLoad(options) {
    const deviceId = options?.id || 'D001';
    this.setData({ deviceId });
    this.fetchDeviceData(deviceId);
  },

  /**
   * 拉取设备控制数据
   */
  async fetchDeviceData(deviceId: string) {
    this.setData({ loading: true });
    try {
      const res = await getDeviceControl(deviceId);
      this.setData({ device: res.data });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 电源开关切换
   */
  async onPowerChange(event: VantBooleanEvent) {
    const power = event.detail;
    this.setData({ 'device.power': power });
    await this.updateDevice({ power });
  },

  /**
   * 音量滑块变化
   */
  async onVolumeChange(event: VantNumberEvent) {
    const volume = event.detail;
    this.setData({ 'device.volume': volume });
  },

  /**
   * 音量滑块拖动结束，提交更新
   */
  async onVolumeDragEnd(event: VantNumberEvent) {
    const volume = event.detail;
    await this.updateDevice({ volume });
  },

  /**
   * 模式切换
   */
  async onModeChange(event: VantStringEvent) {
    const mode = event.detail as DeviceControlData['mode'];
    this.setData({ 'device.mode': mode });
    await this.updateDevice({ mode });
  },

  /**
   * 更新设备状态
   */
  async updateDevice(partial: Partial<DeviceControlData>) {
    try {
      const res = await updateDeviceControl(this.data.deviceId, partial);
      this.setData({ device: res.data });
    } catch (error) {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },
});
