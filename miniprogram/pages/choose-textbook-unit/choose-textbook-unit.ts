import { getTextbookUnits, TextbookUnit, ensureAuthToken } from '../../api/api';

interface UnitDisplayItem {
  key: string;
  title: string;
  description: string;
  cefrLevel?: string | null;
  difficulty?: number | null;
}

/**
 * 选择教材单元页
 * 进入页面后立即展示加载状态，异步获取单元列表。
 */
Page({
  data: {
    deviceId: '',
    textbookId: '',
    loading: true,
    units: [] as UnitDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.deviceId || '';
    const textbookId = options?.textbookId || '';
    this.setData({ deviceId, textbookId });
    this.loadUnits();
  },

  /**
   * 加载单元列表
   */
  async loadUnits() {
    this.setData({ loading: true });

    try {
      await ensureAuthToken();
      const res = await getTextbookUnits(this.data.textbookId);
      const units = res.data.map(this.mapUnitToDisplay);
      this.setData({ units, loading: false });
    } catch (error) {
      console.error('[choose-textbook-unit] load units failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 将服务端单元映射为页面展示项
   */
  mapUnitToDisplay(unit: TextbookUnit): UnitDisplayItem {
    return {
      key: unit.unitId,
      title: unit.name,
      description: unit.description || '',
      cefrLevel: unit.cefrLevel,
      difficulty: unit.difficulty,
    };
  },

  /**
   * 选择单元
   * TODO: 将 textbookId + unitId 写入 DeviceConfig 或带入学习/对话页
   */
  onSelectUnit(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    wx.showToast({
      title: `已选择单元：${key}`,
      icon: 'none',
    });
  },
});
