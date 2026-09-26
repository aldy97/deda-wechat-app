import {
  getOwnerInfo,
  getLearningStatsDashboard,
  getLearningStatsDaily,
  getLearningStatsTopics,
  getLearningStatsTimeline,
  getLearningStatsUnitProgress,
  OwnerInfo,
  LearningStatsDashboard,
  LearningStatsDailyPoint,
  LearningStatsTopic,
  LearningStatsTimelineEvent,
} from "../../api/api";
import { formatChatTime } from "../../utils/date";
import {
  groupUnitProgressByTextbook,
  getRangeDays,
  TextbookUnitProgress,
} from "../learning-data/learning-data.utils";

interface TimelineItem extends LearningStatsTimelineEvent {
  displayTime: string;
}

interface LoadingState {
  profile: boolean;
  metrics: boolean;
  trend: boolean;
  topics: boolean;
  unitProgress: boolean;
  timeline: boolean;
}

/**
 * 单设备智能分析页
 * 每个区块独立加载、独立 Skeleton。
 */
Page({
  data: {
    deviceId: "",
    loading: {
      profile: true,
      metrics: true,
      trend: true,
      topics: true,
      unitProgress: true,
      timeline: true,
    } as LoadingState,
    profile: {} as OwnerInfo,
    dashboard: {} as LearningStatsDashboard,
    trend: [] as LearningStatsDailyPoint[],
    topics: [] as LearningStatsTopic[],
    unitProgress: [] as TextbookUnitProgress[],
    timeline: [] as TimelineItem[],
    activeRange: "week" as "today" | "week" | "month",
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备 ID", icon: "none" });
      return;
    }
    this.loadAll(deviceId, this.data.activeRange);
  },

  async onPullDownRefresh() {
    await this.loadAll(this.data.deviceId, this.data.activeRange);
    wx.stopPullDownRefresh();
  },

  async loadAll(deviceId: string, range: "today" | "week" | "month") {
    this.setData({ page: 1 });
    await Promise.all([
      this.loadProfile(deviceId),
      this.loadMetrics(deviceId),
      this.loadTrend(deviceId, range),
      this.loadTopics(deviceId),
      this.loadUnitProgress(deviceId),
      this.loadTimeline(deviceId, true),
    ]);
  },

  setLoading(key: keyof LoadingState, value: boolean) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },

  async loadProfile(deviceId: string) {
    this.setLoading("profile", true);
    try {
      const res = await getOwnerInfo(deviceId);
      this.setData({ profile: res.data || {} });
    } catch (error) {
      wx.showToast({ title: "档案加载失败", icon: "none" });
    } finally {
      this.setLoading("profile", false);
    }
  },

  async loadMetrics(deviceId: string) {
    this.setLoading("metrics", true);
    try {
      const res = await getLearningStatsDashboard(deviceId);
      this.setData({ dashboard: res.data });
    } catch (error) {
      wx.showToast({ title: "指标加载失败", icon: "none" });
    } finally {
      this.setLoading("metrics", false);
    }
  },

  async loadTrend(deviceId: string, range: "today" | "week" | "month") {
    this.setLoading("trend", true);
    try {
      const days = getRangeDays(range);
      const res = await getLearningStatsDaily(deviceId, days);
      this.setData({ trend: res.data });
    } catch (error) {
      wx.showToast({ title: "趋势加载失败", icon: "none" });
    } finally {
      this.setLoading("trend", false);
    }
  },

  async loadTopics(deviceId: string) {
    this.setLoading("topics", true);
    try {
      const res = await getLearningStatsTopics(deviceId);
      this.setData({ topics: res.data });
    } catch (error) {
      wx.showToast({ title: "主题加载失败", icon: "none" });
    } finally {
      this.setLoading("topics", false);
    }
  },

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

  async loadTimeline(deviceId: string, reset = false) {
    if (reset) {
      this.setData({ page: 1, timeline: [] });
    }
    this.setLoading("timeline", true);
    try {
      const res = await getLearningStatsTimeline(
        deviceId,
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
      wx.showToast({ title: "动态加载失败", icon: "none" });
    } finally {
      this.setLoading("timeline", false);
    }
  },

  onRangeChange(event: { detail: { name: string } }) {
    const range = event.detail.name as "today" | "week" | "month";
    this.setData({ activeRange: range });
    this.loadTrend(this.data.deviceId, range);
  },

  async onLoadMore() {
    if (!this.data.hasMore || this.data.loading.timeline) return;
    this.setData({ page: this.data.page + 1 });
    await this.loadTimeline(this.data.deviceId);
  },
});
