import {
  getLearningStatsDashboard,
  getLearningStatsDaily,
  getLearningStatsTopics,
  getLearningStatsTimeline,
  getLearningStatsUnitProgress,
  LearningStatsDashboard,
  LearningStatsDailyPoint,
  LearningStatsTopic,
  LearningStatsTimelineEvent,
} from "../../api/api";
import { formatChatTime } from "../../utils/date";
import {
  groupUnitProgressByTextbook,
  TextbookUnitProgress,
} from "./learning-data.utils";

interface TimelineItem extends LearningStatsTimelineEvent {
  displayTime: string;
}

interface LoadingState {
  summary: boolean;
  trend: boolean;
  topics: boolean;
  devices: boolean;
  unitProgress: boolean;
  timeline: boolean;
}

/**
 * 学习 Tab - 家庭全览页
 * 每个区块独立加载、独立 Skeleton，互不阻塞。
 */
Page({
  data: {
    loading: {
      summary: true,
      trend: true,
      topics: true,
      devices: true,
      unitProgress: true,
      timeline: true,
    } as LoadingState,
    dashboard: {} as LearningStatsDashboard,
    trend: [] as LearningStatsDailyPoint[],
    topics: [] as LearningStatsTopic[],
    unitProgress: [] as TextbookUnitProgress[],
    timeline: [] as TimelineItem[],
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

  onLoad() {
    this.loadSummary();
    this.loadTrend();
    this.loadTopics();
    this.loadTimeline(true);
  },

  async onPullDownRefresh() {
    this.setData({ page: 1 });
    await Promise.all([
      this.loadSummary(),
      this.loadTrend(),
      this.loadTopics(),
      this.loadTimeline(true),
    ]);
    wx.stopPullDownRefresh();
  },

  setLoading(key: keyof LoadingState, value: boolean) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },

  /**
   * 加载顶部汇总卡 + 孩子设备
   */
  async loadSummary() {
    this.setLoading("summary", true);
    this.setLoading("devices", true);
    try {
      const res = await getLearningStatsDashboard();
      this.setData({ dashboard: res.data });
      const firstDeviceId = res.data.devices[0]?.deviceId;
      if (firstDeviceId) {
        this.loadUnitProgress(firstDeviceId);
      } else {
        this.setLoading("unitProgress", false);
      }
    } catch (error) {
      wx.showToast({ title: "汇总加载失败", icon: "none" });
    } finally {
      this.setLoading("summary", false);
      this.setLoading("devices", false);
    }
  },

  /**
   * 加载近 7 天趋势
   */
  async loadTrend() {
    this.setLoading("trend", true);
    try {
      const res = await getLearningStatsDaily(undefined, 7);
      this.setData({ trend: res.data });
    } catch (error) {
      wx.showToast({ title: "趋势加载失败", icon: "none" });
    } finally {
      this.setLoading("trend", false);
    }
  },

  /**
   * 加载主题分布
   */
  async loadTopics() {
    this.setLoading("topics", true);
    try {
      const res = await getLearningStatsTopics();
      this.setData({ topics: res.data });
    } catch (error) {
      wx.showToast({ title: "主题加载失败", icon: "none" });
    } finally {
      this.setLoading("topics", false);
    }
  },

  /**
   * 加载单元进度
   */
  async loadUnitProgress(deviceId: string) {
    this.setLoading("unitProgress", true);
    try {
      const res = await getLearningStatsUnitProgress(deviceId);
      this.setData({
        unitProgress: groupUnitProgressByTextbook(res.data),
      });
    } catch (error) {
      wx.showToast({ title: "单元进度加载失败", icon: "none" });
    } finally {
      this.setLoading("unitProgress", false);
    }
  },

  /**
   * 加载动态时间线
   */
  async loadTimeline(reset = false) {
    if (reset) {
      this.setData({ page: 1, timeline: [] });
    }

    this.setLoading("timeline", true);
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
    } finally {
      this.setLoading("timeline", false);
    }
  },

  /**
   * 加载更多时间线
   */
  async onLoadMore() {
    if (!this.data.hasMore || this.data.loading.timeline) return;
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
