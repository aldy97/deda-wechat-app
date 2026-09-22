import { getConversationModes, ConversationMode, ensureAuthToken } from '../../api/api';

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
    modes: [] as ModeDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadFreeChatModes();
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
   * 选择具体自由对话模式
   */
  onSelectMode(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    console.log('[choose-free-chat-mode] selected mode:', key);
    // TODO: 调用设备配置切换接口，将模式同步到设备
    wx.showToast({ title: `已选择：${key}`, icon: 'none' });
  },
});
