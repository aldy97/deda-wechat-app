import {
  getDeviceList,
  bindDevice,
  getDeviceStatus,
  getDeviceCurrentConfig,
  Device,
  DeviceStatus,
  DeviceConfig,
  ensureAuthToken,
} from '../../api/api';

/** 本地联调样机 DEV001 */
const DEV001_DEVICE: Device = {
  id: 'dev-local-001',
  name: 'DEV001（联调样机）',
  deviceId: 'dev-local-001',
  deviceCode: 'DEV001',
  networkType: '4G',
};

/** 模式展示名映射 */
const MODE_DISPLAY_MAP: Record<string, string> = {
  free_chat: '自由对话',
  textbook_learning: '教材学习',
  locked_unit: '教材单元',
  free_textbook: '自由教材',
};

/** 设备展示项 = 基础信息 + 状态信息 + 卡片内容 */
interface DeviceDisplayItem extends Device {
  status?: DeviceStatus['status'];
  battery?: number;
  isCharging?: boolean;
  lastActiveAt?: string;
  statusLoading?: boolean;
  cardTitle?: string;
  cardSubtitle?: string;
  cardDesc?: string;
}

/**
 * 设备列表页
 * 从后端拉取当前登录用户的真实绑定设备；若为空则自动绑定本地联调样机 DEV001。
 */
Page({
  data: {
    loading: true,
    devices: [] as DeviceDisplayItem[],
  },

  onLoad() {
    this.loadDeviceList();
  },

  onShow() {
    this.loadDeviceList();
  },

  /**
   * 加载设备列表：优先真实绑定，空则自动绑定 DEV001
   */
  async loadDeviceList() {
    this.setData({ loading: true });

    try {
      await ensureAuthToken();
      let devices = await this.fetchBoundDevices();

      if (devices.length === 0) {
        console.log('[device-list] no bound devices, auto-bind DEV001');
        await bindDevice({ deviceId: DEV001_DEVICE.deviceId });
        devices = await this.fetchBoundDevices();
      }

      const displayItems = await this.enrichDevices(devices);
      this.setData({ devices: displayItems, loading: false });
    } catch (error) {
      console.error('[device-list] load device list failed:', error);
      wx.showToast({
        title: error instanceof Error ? error.message : '加载设备失败',
        icon: 'none',
      });
      this.setData({ devices: [], loading: false });
    }
  },

  /**
   * 从后端获取当前用户已绑定设备
   */
  async fetchBoundDevices(): Promise<Device[]> {
    const res = await getDeviceList();
    return res.data || [];
  },

  /**
   * 为设备列表补充状态与当前配置
   */
  async enrichDevices(devices: Device[]): Promise<DeviceDisplayItem[]> {
    return Promise.all(
      devices.map(async (device) => {
        const item: DeviceDisplayItem = { ...device, statusLoading: true };

        const cachedConfig = this.getDeviceConfigCache(item.id);
        if (cachedConfig) {
          this.applyConfigToDevice(item, cachedConfig);
        }

        try {
          const [status, serverConfig] = await Promise.all([
            this.fetchDeviceStatus(item.id),
            this.fetchDeviceCurrentConfig(item.id),
          ]);
          item.status = status.status;
          item.battery = status.battery;
          item.isCharging = status.isCharging;
          item.lastActiveAt = status.lastActiveAt;
          if (serverConfig) {
            // 服务端配置不含 name/description，需与本地缓存合并保留
            const mergedConfig: DeviceConfig = {
              ...serverConfig,
              conversationModeName:
                serverConfig.conversationModeName ||
                cachedConfig?.conversationModeName,
              conversationModeDescription:
                serverConfig.conversationModeDescription ||
                cachedConfig?.conversationModeDescription,
              unitDescription:
                serverConfig.unitDescription || cachedConfig?.unitDescription,
            };
            this.applyConfigToDevice(item, mergedConfig);
            this.saveDeviceConfigCache(mergedConfig);
          }
        } catch (error) {
          item.status = item.status || 'offline';
          item.battery = item.battery ?? 0;
          item.isCharging = item.isCharging ?? false;
        } finally {
          item.statusLoading = false;
        }

        return item;
      }),
    );
  },

  /**
   * 获取单个设备状态/电量
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
   * 获取设备当前生效配置
   */
  async fetchDeviceCurrentConfig(deviceId: string): Promise<DeviceConfig | null> {
    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(deviceId);
      return res.data;
    } catch (error) {
      console.error('[device-list] fetch current config failed:', error);
      return null;
    }
  },

  /**
   * 将配置应用到设备展示项
   */
  applyConfigToDevice(device: DeviceDisplayItem, config: DeviceConfig) {
    const modeName = MODE_DISPLAY_MAP[config.mode] || config.mode;

    if (config.mode === 'free_chat') {
      // 自由对话：标题显示子模式中文名，描述显示子模式描述
      device.cardTitle = config.conversationModeName || config.conversationModeKey || modeName;
      device.cardSubtitle = '';
      device.cardDesc =
        config.conversationModeDescription ||
        '自由对话模式，随时陪伴孩子聊天互动。';
    } else if (config.textbookId) {
      // 教材模式：标题显示教材名，副标题显示单元名，描述显示单元描述
      device.cardTitle = config.textbookName || config.textbookId;
      device.cardSubtitle = config.unitName || config.unitId || '';
      device.cardDesc =
        config.unitDescription ||
        config.textbookName ||
        config.textbookId ||
        '教材学习模式，系统化提升英语能力。';
    } else {
      // 兜底
      device.cardTitle = modeName;
      device.cardSubtitle = '';
      device.cardDesc = 'DEDA AI 玩偶，随时在线陪伴孩子学习与成长。';
    }
  },

  /**
   * 读取本地配置缓存
   */
  getDeviceConfigCache(deviceId: string): DeviceConfig | null {
    try {
      return wx.getStorageSync(`device_config_${deviceId}`) as DeviceConfig | undefined || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * 写入本地配置缓存
   */
  saveDeviceConfigCache(config: DeviceConfig) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn('[device-list] save config cache failed:', error);
    }
  },

  /**
   * 供其他页面调用，直接更新设备列表中的配置显示
   */
  updateDeviceConfig(config: DeviceConfig) {
    const { devices } = this.data;
    const index = devices.findIndex((d) => d.id === config.deviceId);
    if (index === -1) return;

    const device = { ...devices[index] };
    this.applyConfigToDevice(device, config);
    this.setData({ [`devices[${index}]`]: device });
    this.saveDeviceConfigCache(config);
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
