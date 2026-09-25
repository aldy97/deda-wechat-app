import {
  getLearningStatsDashboard,
  getLearningStatsDaily,
  getLearningStatsTopics,
  getLearningStatsTimeline,
  LearningStatsDashboard,
  LearningStatsDailyPoint,
  LearningStatsTopic,
  LearningStatsTimelineEvent,
} from "../../api/api";
import { formatChatTime } from "../../utils/date";

interface TimelineItem extends LearningStatsTimelineEvent {
  displayTime: string;
}

/**
 * 学习 Tab - 家庭全览页
 * 展示家长账号下所有设备的学习汇总、趋势、主题分布与动态时间线。
 */
Page({
  data: {
    loading: true,
    dashboard: {} as LearningStatsDashboard,
    trend: [] as LearningStatsDailyPoint[],
    topics: [] as LearningStatsTopic[],
    timeline: [] as TimelineItem[],
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

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
    this.setData({ loading: true, page: 1 });
    try {
      const [dashboardRes, trendRes, topicsRes] = await Promise.all([
        getLearningStatsDashboard(),
        getLearningStatsDaily(undefined, 7),
        getLearningStatsTopics(),
      ]);

      this.setData({
        dashboard: dashboardRes.data,
        trend: trendRes.data,
        topics: topicsRes.data,
      });

      await this.loadTimeline(true);
    } catch (error) {
      wx.showToast({ title: "加载失败", icon: "none" });
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
    }

    try {
      const res = await getLearningStatsTimeline(
        undefined,
        this.data.page,
        this.data.pageSize,
      );
      const { items, total } = res.data;
      const formatted = items.map((item) => ({
        ...item,
        displayTime: formatChatTime(item.createdAt),
      }));

      this.setData({
        timeline: reset ? formatted : this.data.timeline.concat(formatted),
        hasMore: this.data.timeline.length + formatted.length < total,
        page: this.data.page,
      });
    } catch (error) {
      wx.showToast({ title: "时间线加载失败", icon: "none" });
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
