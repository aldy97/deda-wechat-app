import { getConversationModeCategories, ConversationModeCategory, ensureAuthToken } from '../../api/api';

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
    modes: [] as CategoryDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadCategories();
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
   * 选择模式
   * - 自由对话模式：跳转选择自由对话模式页
   * - 教材学习：跳转教材学习页
   */
  onSelectMode(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    if (key === 'free_chat') {
      wx.navigateTo({
        url: `/pages/choose-free-chat-mode/choose-free-chat-mode?id=${this.data.deviceId}`,
      });
    } else if (key === 'textbook_learning') {
      wx.navigateTo({
        url: `/pages/textbook-learning/textbook-learning?id=${this.data.deviceId}`,
      });
    }
  },
});
