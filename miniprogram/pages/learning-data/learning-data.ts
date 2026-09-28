import {
  getLearningStatsDashboard,
  getLearningStatsDaily,
  getLearningStatsTopics,
  getLearningStatsTimeline,
  getLearningStatsInsights,
  getLearningStatsHealth,
  getDeviceStatus,
  LearningStatsDashboard,
  LearningStatsDailyPoint,
  LearningStatsDeviceSummary,
  LearningStatsHealth,
  LearningStatsInsight,
  LearningStatsTopic,
  LearningStatsTimelineEvent,
} from "../../api/api";
import { formatChatTime } from "../../utils/date";
import {
  aggregateFamilyTrend,
  calculateHealthScore,
  enrichDevicesWithStatus,
  generateFallbackInsights,
  HealthScoreResult,
  TrendBar,
} from "./learning-analytics";

interface TimelineItem extends LearningStatsTimelineEvent {
  displayTime: string;
}

interface LoadingState {
  summary: boolean;
  trend: boolean;
  topics: boolean;
  devices: boolean;
  timeline: boolean;
  insights: boolean;
  health: boolean;
}

/**
 * 学习 Tab - 家庭全览页
 * 家长视角的多设备学习总览 + 轻量级智能分析入口。
 * 每个区块独立加载、独立 Skeleton，互不阻塞。
 */
Page({
  data: {
    loading: {
      summary: true,
      trend: true,
      topics: true,
      devices: true,
      timeline: true,
      insights: true,
      health: true,
    } as LoadingState,
    activeRange: "week" as "today" | "week" | "month",
    dashboard: {} as LearningStatsDashboard,
    trendBars: [] as TrendBar[],
    topics: [] as LearningStatsTopic[],
    timeline: [] as TimelineItem[],
    insights: [] as LearningStatsInsight[],
    health: {} as LearningStatsHealth,
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    // Tab 切换回来时刷新，避免设备状态与设备列表页不一致
    this.loadAll();
  },

  async onPullDownRefresh() {
    this.setData({ page: 1 });
    await this.loadAll();
    wx.stopPullDownRefresh();
  },

  setLoading(key: keyof LoadingState, value: boolean) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },

  /**
   * 切换时间范围：今日 / 本周 / 本月
   */
  onRangeChange(event: { detail: { name: string } }) {
    const range = event.detail.name as "today" | "week" | "month";
    this.setData({ activeRange: range });
    this.loadAll();
  },

  /**
   * 加载全部区块
   */
  async loadAll() {
    this.setData({ page: 1 });
    await Promise.all([
      this.loadSummary(),
      this.loadTrend(),
      this.loadTopics(),
      this.loadTimeline(true),
      this.loadInsights(),
      this.loadHealth(),
    ]);
  },

  /**
   * 加载顶部汇总卡 + 孩子设备
   */
  async loadSummary() {
    this.setLoading("summary", true);
    this.setLoading("devices", true);
    try {
      const res = await getLearningStatsDashboard(
        undefined,
        this.data.activeRange,
      );
      this.setData({ dashboard: res.data });
      await this.enrichDeviceStatuses(res.data.devices);
    } catch (error) {
      wx.showToast({ title: "汇总加载失败", icon: "none" });
    } finally {
      this.setLoading("summary", false);
      this.setLoading("devices", false);
    }
  },

  /**
   * 用 getDeviceStatus 实时校正设备状态，保证与设备列表页一致。
   * 失败时保留 dashboard 原有状态，不影响页面可用性。
   */
  async enrichDeviceStatuses(devices: LearningStatsDeviceSummary[]) {
    if (!devices || devices.length === 0) return;

    const statusMap: Record<string, any> = {};
    await Promise.all(
      devices.map(async (device) => {
        try {
          const res = await getDeviceStatus(device.deviceId);
          statusMap[device.deviceId] = res.data;
        } catch (error) {
          // 状态校正失败时保留 dashboard 原状态
        }
      }),
    );

    const enriched = enrichDevicesWithStatus(devices, statusMap);
    this.setData({
      dashboard: {
        ...this.data.dashboard,
        devices: enriched,
      },
    });
  },

  /**
   * 加载学习趋势
   */
  async loadTrend() {
    this.setLoading("trend", true);
    try {
      const days = this.getTrendDays();
      const res = await getLearningStatsDaily(undefined, days);
      this.setData({
        trendBars: aggregateFamilyTrend(res.data, this.data.activeRange),
      });
    } catch (error) {
      wx.showToast({ title: "趋势加载失败", icon: "none" });
    } finally {
      this.setLoading("trend", false);
    }
  },

  /**
   * 根据当前范围返回趋势图所需天数
   */
  getTrendDays(): number {
    const map: Record<"today" | "week" | "month", number> = {
      today: 1,
      week: 7,
      month: 30,
    };
    return map[this.data.activeRange];
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
   * 加载 AI 学习洞察
   * 后端不可用时，使用前端兜底规则生成。
   */
  async loadInsights() {
    this.setLoading("insights", true);
    try {
      const res = await getLearningStatsInsights(
        undefined,
        this.data.activeRange,
      );
      const list = res.data || [];
      this.setData({
        insights: list.length > 0 ? list : this.buildFallbackInsights(),
      });
    } catch (error) {
      this.setData({ insights: this.buildFallbackInsights() });
    } finally {
      this.setLoading("insights", false);
    }
  },

  /**
   * 加载学习健康度
   * 后端不可用时，使用前端兜底计算。
   */
  async loadHealth() {
    this.setLoading("health", true);
    try {
      const res = await getLearningStatsHealth(
        undefined,
        this.data.activeRange,
      );
      this.setData({ health: res.data });
    } catch (error) {
      this.setData({ health: this.buildFallbackHealth() });
    } finally {
      this.setLoading("health", false);
    }
  },

  /**
   * 基于当前已有数据生成兜底洞察
   */
  buildFallbackInsights(): LearningStatsInsight[] {
    const { dashboard, trendBars, topics, activeRange } = this.data;
    if (!dashboard.devices) return [];

    return generateFallbackInsights({
      dashboard,
      trend: trendBars.map((bar) => ({
        date: bar.label,
        durationMinutes: bar.value,
        sessionCount: 0,
      })),
      topics,
      range: activeRange,
    });
  },

  /**
   * 基于当前已有数据生成兜底健康度
   */
  buildFallbackHealth(): HealthScoreResult {
    const { dashboard, trendBars, topics, activeRange } = this.data;

    return calculateHealthScore({
      dashboard,
      trend: trendBars.map((bar) => ({
        date: bar.label,
        durationMinutes: bar.value,
        sessionCount: 0,
      })),
      topics,
      range: activeRange,
    });
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
