import {
  getLearningStatsDashboard,
  getLearningStatsTopics,
  getLearningStatsTimeline,
  getLearningStatsInsights,
  getDeviceStatus,
  LearningStatsDashboard,
  LearningStatsDeviceSummary,
  LearningStatsInsight,
  LearningStatsTopic,
} from "../../api/api";
import { formatChatTime } from "../../utils/date";
import {
  enrichDevicesWithStatus,
  generateFallbackInsights,
} from "./learning-analytics";
import {
  groupTimelineByDayAndDevice,
  TimelineDayGroup,
} from "./learning-data.utils";

interface LoadingState {
  summary: boolean;
  topics: boolean;
  devices: boolean;
  timeline: boolean;
  insights: boolean;
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
      topics: true,
      devices: true,
      timeline: true,
      insights: true,
    } as LoadingState,
    activeRange: "week" as "today" | "week" | "month",
    dashboard: {} as LearningStatsDashboard,
    topics: [] as LearningStatsTopic[],
    timeline: [] as TimelineDayGroup[],
    insights: [] as LearningStatsInsight[],
    page: 1,
    pageSize: 10,
    hasMore: true,
  },

  async onLoad() {
    await this.loadAll();
  },

  async onShow() {
    // Tab 切换回来时刷新，避免设备状态与设备列表页不一致
    await this.loadAll();
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
  async onRangeChange(event: { detail: { name: string } }) {
    const range = event.detail.name as "today" | "week" | "month";
    this.setData({ activeRange: range });
    await this.loadAll();
  },

  /**
   * 加载全部区块
   */
  async loadAll() {
    this.setData({ page: 1 });
    await this.loadSummary();
    await Promise.all([
      this.loadTopics(),
      this.loadTimeline(true),
      this.loadInsights(),
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
      const dashboard = {
        ...res.data,
        maxContinuousDays: Math.max(
          0,
          ...(res.data.devices || []).map((d) => d.continuousDays || 0),
        ),
      };
      this.setData({ dashboard });
      await this.enrichDeviceStatuses(dashboard.devices);
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
   * 基于当前已有数据生成兜底洞察
   */
  buildFallbackInsights(): LearningStatsInsight[] {
    const { dashboard, topics, activeRange } = this.data;
    if (!dashboard || !dashboard.devices) return [];

    return generateFallbackInsights({
      dashboard,
      trend: [],
      topics,
      range: activeRange,
    });
  },

  /**
   * 加载动态时间线
   * 后端返回扁平列表，前端按日期 + 设备分组渲染。
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

      const newGroups = groupTimelineByDayAndDevice(formatted);
      const merged = reset
        ? newGroups
        : this.mergeTimelineGroups(this.data.timeline, newGroups);

      this.setData({
        timeline: merged,
        hasMore: this.countTimelineEvents(merged) < total,
        page: this.data.page,
      });
    } catch (error) {
      wx.showToast({ title: "时间线加载失败", icon: "none" });
    } finally {
      this.setLoading("timeline", false);
    }
  },

  /**
   * 合并新旧分组时间线：同日期同设备的事件追加，新日期插入队首。
   */
  mergeTimelineGroups(
    existing: TimelineDayGroup[],
    incoming: TimelineDayGroup[],
  ): TimelineDayGroup[] {
    const map = new Map<string, TimelineDayGroup>();
    for (const day of existing) {
      map.set(day.date, day);
    }

    for (const day of incoming) {
      const current = map.get(day.date);
      if (!current) {
        map.set(day.date, day);
        continue;
      }

      const deviceMap = new Map<string, (typeof current.devices)[0]>();
      for (const d of current.devices) deviceMap.set(d.deviceId, d);
      for (const d of day.devices) {
        const existingDevice = deviceMap.get(d.deviceId);
        if (existingDevice) {
          existingDevice.events.push(...d.events);
          existingDevice.totalDurationMinutes += d.totalDurationMinutes;
        } else {
          current.devices.push(d);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  },

  countTimelineEvents(groups: TimelineDayGroup[]): number {
    return groups.reduce(
      (sum, day) =>
        sum +
        day.devices.reduce((dSum, device) => dSum + device.events.length, 0),
      0,
    );
  },

  /**
   * 切换某一天某一设备的展开/折叠状态
   */
  onToggleDeviceGroup(event: WechatMiniprogram.TouchEvent) {
    const { date, deviceId } = event.currentTarget.dataset;
    const groups = this.data.timeline.map((day) => {
      if (day.date !== date) return day;
      return {
        ...day,
        devices: day.devices.map((device) =>
          device.deviceId === deviceId
            ? { ...device, expanded: !device.expanded }
            : device,
        ),
      };
    });
    this.setData({ timeline: groups });
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
