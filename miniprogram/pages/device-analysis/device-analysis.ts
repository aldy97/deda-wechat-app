import {
  getChildProfile,
  getDeviceAnalysis,
  getDeviceTextbookProgress,
  getDeviceTrend,
  ChildProfile,
  DeviceAnalysis,
  TextbookProgress,
  TrendPoint,
} from '../../api/api';

/**
 * 单设备智能分析页
 * 展示绑定该设备的孩子个人学情：核心指标、口语维度、教材进度、最近记录。
 */
Page({
  data: {
    deviceId: '',
    loading: true,
    profile: {} as ChildProfile,
    analysis: {} as DeviceAnalysis,
    textbooks: [] as TextbookProgress[],
    trend: [] as TrendPoint[],
    activeRange: 'week' as 'today' | 'week' | 'month',
    expandedModules: {} as Record<string, boolean>,
  },

  onLoad(options) {
    const deviceId = options?.id || 'D001';
    this.setData({ deviceId });
    this.loadAll(deviceId, this.data.activeRange);
  },

  async onPullDownRefresh() {
    await this.loadAll(this.data.deviceId, this.data.activeRange);
    wx.stopPullDownRefresh();
  },

  /**
   * 加载页面全部数据
   */
  async loadAll(deviceId: string, range: 'today' | 'week' | 'month') {
    this.setData({ loading: true });
    try {
      const [profileRes, analysisRes, textbooksRes, trendRes] = await Promise.all([
        getChildProfile(deviceId),
        getDeviceAnalysis(deviceId, range),
        getDeviceTextbookProgress(deviceId),
        getDeviceTrend(deviceId, 7),
      ]);

      this.setData({
        profile: profileRes.data,
        analysis: analysisRes.data,
        textbooks: textbooksRes.data,
        trend: trendRes.data,
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 切换时间范围
   */
  onRangeChange(event: { detail: { name: string } }) {
    const range = event.detail.name as 'today' | 'week' | 'month';
    this.setData({ activeRange: range });
    this.loadAll(this.data.deviceId, range);
  },

  /**
   * 展开/收起教材模块
   */
  onToggleModule(event: WechatMiniprogram.TouchEvent) {
    const { moduleId } = event.currentTarget.dataset;
    const expandedModules = { ...this.data.expandedModules };
    expandedModules[moduleId] = !expandedModules[moduleId];
    this.setData({ expandedModules });
  },

  /**
   * 点击单元：跳转该模块的对话记录
   */
  onUnitTap(event: WechatMiniprogram.TouchEvent) {
    const { textbookId, moduleId, unitId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?deviceId=${this.data.deviceId}&textbookId=${textbookId}&moduleId=${moduleId}&unitId=${unitId}`,
    });
  },

  /**
   * 点击最近记录：跳转对话记录
   */
  onRecordTap(event: WechatMiniprogram.TouchEvent) {
    const { recordId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?deviceId=${this.data.deviceId}&recordId=${recordId}`,
    });
  },
});
