import { getTextbooks, Textbook, ensureAuthToken } from '../../api/api';

interface TextbookDisplayItem {
  key: string;
  title: string;
  description: string;
  cefrLevel?: string | null;
}

/**
 * 教材学习页
 * 从服务端动态获取教材列表，点击后跳转单元选择页。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    textbooks: [] as TextbookDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadTextbooks();
  },

  /**
   * 加载教材列表
   */
  async loadTextbooks() {
    this.setData({ loading: true });

    try {
      await ensureAuthToken();
      const res = await getTextbooks();
      const textbooks = res.data.map(this.mapTextbookToDisplay);
      this.setData({ textbooks, loading: false });
    } catch (error) {
      console.error('[textbook-learning] load textbooks failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 将服务端教材映射为页面展示项
   */
  mapTextbookToDisplay(textbook: Textbook): TextbookDisplayItem {
    return {
      key: textbook.textbookId,
      title: textbook.name,
      description: textbook.description || '',
      cefrLevel: textbook.cefrLevel,
    };
  },

  /**
   * 选择教材，跳转单元选择页
   */
  onSelectTextbook(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/choose-textbook-unit/choose-textbook-unit?deviceId=${this.data.deviceId}&textbookId=${key}`,
    });
  },
});
