import {
  getConversationModeCategories,
  getDeviceCurrentConfig,
  switchDeviceMode,
  ConversationModeCategory,
  DeviceConfig,
  ensureAuthToken,
} from '../../api/api';

/** 缓存键 */
const CACHE_KEY = 'switch_mode_categories_cache';
/** 缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;

interface CategoryDisplayItem {
  key: string;
  title: string;
  description: string;
}

/**
 * 切换模式页
 * 从服务端动态获取学习/对话模式分类，支持缓存与加载态。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    saving: false,
    currentMode: '',
    modes: [] as CategoryDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadCategories();
    this.loadCurrentConfig();
  },

  /**
   * 加载模式分类：优先缓存，后台刷新
   */
  async loadCategories() {
    const cache = this.getCache();
    if (cache) {
      this.setData({ modes: cache.data, loading: false });
    }

    try {
      await ensureAuthToken();
      const res = await getConversationModeCategories();
      const modes = res.data.map(this.mapCategoryToDisplay);
      this.setData({ modes, loading: false });
      this.saveCache(modes);
    } catch (error) {
      console.error('[switch-mode] load categories failed:', error);
      if (!cache) {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }
  },

  /**
   * 加载当前生效配置，用于高亮已选分类
   */
  async loadCurrentConfig() {
    if (!this.data.deviceId) return;

    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(this.data.deviceId);
      const config = res.data;
      this.setData({ currentMode: config.mode });
      this.saveDeviceConfigCache(config);
    } catch (error) {
      console.error('[switch-mode] load current config failed:', error);
    }
  },

  /**
   * 将服务端分类映射为页面展示项
   */
  mapCategoryToDisplay(category: ConversationModeCategory): CategoryDisplayItem {
    return {
      key: category.key,
      title: category.name,
      description: category.description || '',
    };
  },

  /**
   * 读取本地缓存
   */
  getCache(): { data: CategoryDisplayItem[]; timestamp: number } | null {
    try {
      const cache = wx.getStorageSync(CACHE_KEY) as { data: CategoryDisplayItem[]; timestamp: number } | undefined;
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
  saveCache(modes: CategoryDisplayItem[]) {
    try {
      wx.setStorageSync(CACHE_KEY, { data: modes, timestamp: Date.now() });
    } catch (error) {
      console.warn('[switch-mode] cache save failed:', error);
    }
  },

  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config: DeviceConfig) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn('[switch-mode] device config cache save failed:', error);
    }
  },

  /**
   * 选择模式
   * - 自由对话模式：先保存 mode=free_chat，再跳转选择自由对话模式页
   * - 教材学习：先保存 mode=textbook_learning，再跳转教材学习页
   */
  async onSelectMode(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    const { deviceId } = this.data;

    if (!deviceId) {
      wx.showToast({ title: '设备 ID 缺失', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      await ensureAuthToken();
      const res = await switchDeviceMode(deviceId, { mode: key });
      const config = res.data;
      this.saveDeviceConfigCache(config);
      this.setData({ currentMode: config.mode, saving: false });

      if (key === 'free_chat') {
        wx.navigateTo({
          url: `/pages/choose-free-chat-mode/choose-free-chat-mode?id=${deviceId}`,
        });
      } else if (key === 'textbook_learning') {
        wx.navigateTo({
          url: `/pages/textbook-learning/textbook-learning?id=${deviceId}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请重试';
      console.error('[switch-mode] switch mode failed:', error);
      this.setData({ saving: false });
      wx.showToast({ title: message, icon: 'none', duration: 2500 });
    }
  },
});
