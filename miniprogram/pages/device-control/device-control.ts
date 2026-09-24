import {
  getDeviceControl,
  updateDeviceControl,
  getDeviceCurrentConfig,
  DeviceControlData,
  DeviceConfig,
  ensureAuthToken,
} from '../../api/api';

/** Vant 组件 change 事件，detail 为当前值 */
interface VantBooleanEvent { detail: boolean; }
interface VantNumberEvent { detail: number; }
interface VantStringEvent { detail: string; }

/** 模式展示名映射 */
const MODE_DISPLAY_MAP: Record<string, string> = {
  free_chat: '自由对话',
  textbook_learning: '教材学习',
  locked_unit: '教材单元',
  free_textbook: '自由教材',
};

/**
 * 设备控制面板页
 * 展示设备开关、音量、模式等控制项。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    device: {} as DeviceControlData,
    currentConfig: null as DeviceConfig | null,
    currentModeDisplay: '',
  },

  onLoad(options) {
    const deviceId = options?.id || 'D001';
    this.setData({ deviceId });
    this.fetchDeviceData(deviceId);
    this.fetchCurrentConfig(deviceId);
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
   * 拉取当前对话模式配置
   */
  async fetchCurrentConfig(deviceId: string) {
    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(deviceId);
      const config = res.data;
      this.setData({
        currentConfig: config,
        currentModeDisplay: this.formatModeDisplay(config),
      });
      wx.setStorageSync(`device_config_${deviceId}`, config);
    } catch (error) {
      console.error('[device-control] fetch current config failed:', error);
    }
  },

  /**
   * 格式化模式展示文本
   */
  formatModeDisplay(config: DeviceConfig): string {
    const modeName = MODE_DISPLAY_MAP[config.mode] || config.mode;
    if (config.mode === 'free_chat' && config.conversationModeKey) {
      return `${modeName} / ${config.conversationModeKey}`;
    }
    if (
      (config.mode === 'textbook_learning' || config.mode === 'locked_unit') &&
      config.textbookId
    ) {
      const textbook = config.textbookName || config.textbookId;
      const unit = config.unitName || config.unitId;
      return unit ? `${modeName} / ${textbook} / ${unit}` : `${modeName} / ${textbook}`;
    }
    if (config.mode === 'free_textbook' && config.textbookId) {
      const textbook = config.textbookName || config.textbookId;
      return `${modeName} / ${textbook}`;
    }
    return modeName;
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
