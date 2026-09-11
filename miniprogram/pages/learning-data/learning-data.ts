import {
  getFamilyOverview,
  getFamilyTrend,
  getFamilyTimeline,
  FamilyOverview,
  TrendPoint,
  TimelineEvent,
} from '../../api/api';
import { paginate, PaginationResult } from '../../utils/pagination';

/**
 * 学习 Tab - 家庭全览页
 * 展示家长账号下所有设备的跨设备学习汇总与动态时间线。
 */
Page({
  data: {
    loading: true,
    overview: {} as FamilyOverview,
    trend: [] as TrendPoint[],
    timeline: [] as TimelineEvent[],
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

  // 本地缓存全部时间线数据
  privateAllTimeline: [] as TimelineEvent[],

  onLoad() {
    this.loadAll();
  },

  async onPullDownRefresh() {
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  /**
   * 加载页面全部数据
   */
  async loadAll() {
    this.setData({ loading: true });
    try {
      const [overviewRes, trendRes] = await Promise.all([
        getFamilyOverview(),
        getFamilyTrend(7),
      ]);

      this.setData({
        overview: overviewRes.data,
        trend: trendRes.data,
      });

      await this.loadTimeline(true);
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载动态时间线
   */
  async loadTimeline(reset = false) {
    if (reset) {
      this.setData({ page: 1, timeline: [] });
      this.privateAllTimeline = [];
    }

    try {
      if (this.privateAllTimeline.length === 0) {
        const res = await getFamilyTimeline(1, 100);
        this.privateAllTimeline = res.data;
      }

      const result: PaginationResult<TimelineEvent> = paginate(
        this.privateAllTimeline,
        this.data.page,
        this.data.pageSize,
      );

      this.setData({
        timeline: reset ? result.list : this.data.timeline.concat(result.list),
        hasMore: result.hasMore,
        page: result.page,
      });
    } catch (error) {
      wx.showToast({ title: '时间线加载失败', icon: 'none' });
    }
  },

  /**
   * 加载更多时间线
   */
  async onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    await this.loadTimeline();
  },

  /**
   * 点击设备汇总卡：进入单设备智能分析
   */
  onDeviceCardTap(event: WechatMiniprogram.TouchEvent) {
    const { deviceId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-analysis/device-analysis?id=${deviceId}`,
    });
  },
});
