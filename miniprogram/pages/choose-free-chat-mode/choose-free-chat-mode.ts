import {
  getConversationModes,
  getDeviceCurrentConfig,
  switchDeviceMode,
  ConversationMode,
  DeviceConfig,
  ensureAuthToken,
} from '../../api/api';

/** 缓存键 */
const CACHE_KEY = 'free_chat_modes_cache';
/** 缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;

interface ModeDisplayItem {
  key: string;
  title: string;
  description: string;
}

/**
 * 选择自由对话模式页
 * 从服务端动态获取自由对话模式下的子模式，支持缓存与加载态。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    saving: false,
    currentSubMode: '',
    modes: [] as ModeDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadFreeChatModes();
    this.loadCurrentConfig();
  },

  /**
   * 加载自由对话模式下的子模式：优先缓存，后台刷新
   */
  async loadFreeChatModes() {
    const cache = this.getCache();
    if (cache) {
      this.setData({ modes: cache.data, loading: false });
    }

    try {
      await ensureAuthToken();
      const res = await getConversationModes('free_chat');
      const modes = res.data.map(this.mapModeToDisplay);
      this.setData({ modes, loading: false });
      this.saveCache(modes);
    } catch (error) {
      console.error('[choose-free-chat-mode] load modes failed:', error);
      if (!cache) {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }
  },

  /**
   * 加载当前生效配置，用于高亮已选子模式
   */
  async loadCurrentConfig() {
    if (!this.data.deviceId) return;

    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(this.data.deviceId);
      const config = res.data;
      if (config.mode === 'free_chat' && config.conversationModeKey) {
        this.setData({ currentSubMode: config.conversationModeKey });
      }
    } catch (error) {
      console.error('[choose-free-chat-mode] load current config failed:', error);
    }
  },

  /**
   * 将服务端模式映射为页面展示项
   */
  mapModeToDisplay(mode: ConversationMode): ModeDisplayItem {
    return {
      key: mode.key,
      title: mode.name,
      description: mode.description || '',
    };
  },

  /**
   * 读取本地缓存
   */
  getCache(): { data: ModeDisplayItem[]; timestamp: number } | null {
    try {
      const cache = wx.getStorageSync(CACHE_KEY) as { data: ModeDisplayItem[]; timestamp: number } | undefined;
      if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
        return cache;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * 写入本地缓存
   */
  saveCache(modes: ModeDisplayItem[]) {
    try {
      wx.setStorageSync(CACHE_KEY, { data: modes, timestamp: Date.now() });
    } catch (error) {
      console.warn('[choose-free-chat-mode] cache save failed:', error);
    }
  },

  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config: DeviceConfig) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn('[choose-free-chat-mode] device config cache save failed:', error);
    }
  },

  /**
   * 更新设备列表页的配置显示，避免返回时闪动
   */
  updateDeviceListPage(config: DeviceConfig) {
    const pages = getCurrentPages();
    const deviceListPage = pages.find((p) => p.route === 'pages/device-list/device-list');
    if (deviceListPage && typeof (deviceListPage as any).updateDeviceConfig === 'function') {
      (deviceListPage as any).updateDeviceConfig(config);
    }
  },

  /**
   * 选择具体自由对话模式
   */
  async onSelectMode(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    const { deviceId } = this.data;

    if (!deviceId) {
      wx.showToast({ title: '设备 ID 缺失', icon: 'none' });
      return;
    }

    this.setData({ saving: true, currentSubMode: key });

    try {
      await ensureAuthToken();
      const res = await switchDeviceMode(deviceId, {
        mode: 'free_chat',
        conversationModeKey: key,
      });
      const config = res.data;
      this.saveDeviceConfigCache(config);
      this.updateDeviceListPage(config);

      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      console.error('[choose-free-chat-mode] switch mode failed:', error);
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
});
