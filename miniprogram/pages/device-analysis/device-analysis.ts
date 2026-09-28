import {
  getOwnerInfo,
  getLearningStatsDashboard,
  getLearningStatsDaily,
  getLearningStatsTopics,
  getLearningStatsActivities,
  getLearningStatsUnitProgress,
  OwnerInfo,
  LearningStatsDashboard,
  LearningStatsTopic,
  LearningStatsActivityDay,
} from "../../api/api";
import {
  groupUnitProgressByTextbook,
  getCalendarRangeDays,
  aggregateDailyToWeekly,
  scaleBarHeights,
  buildContextOptions,
  ContextOption,
  TextbookUnitProgress,
} from "../learning-data/learning-data.utils";

interface TrendBar {
  label: string;
  value: number;
  height: number;
}

interface ActivityEventView {
  icon: string;
  text: string;
  sub?: string;
}

interface ActivityDayView {
  date: string;
  views: ActivityEventView[];
}

interface LoadingState {
  profile: boolean;
  metrics: boolean;
  trend: boolean;
  topics: boolean;
  unitProgress: boolean;
  activities: boolean;
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
      activities: true,
    } as LoadingState,
    profile: {} as OwnerInfo,
    dashboard: {} as LearningStatsDashboard,
    trendBars: [] as TrendBar[],
    todayMinutes: 0,
    todaySessions: 0,
    practiceDisplay: 0,
    topics: [] as LearningStatsTopic[],
    unitProgress: [] as TextbookUnitProgress[],
    activities: [] as ActivityDayView[],
    activeRange: "week" as "today" | "week" | "month",
    contextOptions: [] as ContextOption[],
    contextActions: [] as Array<Record<string, any>>,
    activeContextKey: "default",
    contextLabel: "当前语境",
    trendCaption: "单位:分钟",
    isFreeChatContext: false,
    showContextSheet: false,
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
      this.loadMetrics(deviceId, range),
      this.loadTrend(deviceId, range),
      this.loadTopics(deviceId),
      this.loadUnitProgress(deviceId),
      this.loadActivities(deviceId, true),
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

  /**
   * 当前选中语境的显式参数;default = 空对象,由后端按设备当前配置族兜底。
   * 查看任何语境都是只读操作,不修改设备配置。
   */
  activeContextParams() {
    const option = this.data.contextOptions.find(
      (o) => o.key === this.data.activeContextKey,
    );
    return option?.params ?? {};
  },

  async loadMetrics(deviceId: string, range: "today" | "week" | "month") {
    this.setLoading("metrics", true);
    try {
      const res = await getLearningStatsDashboard(
        deviceId,
        range,
        this.activeContextParams(),
      );
      const d = res.data;
      this.setData({
        dashboard: d,
        // 带 range 时后端返回轮数;缺省回落活跃场次
        practiceDisplay: d.practiceCount ?? d.totalSessions ?? 0,
      });
    } catch (error) {
      wx.showToast({ title: "指标加载失败", icon: "none" });
    } finally {
      this.setLoading("metrics", false);
    }
  },

  async loadTrend(deviceId: string, range: "today" | "week" | "month") {
    this.setLoading("trend", true);
    try {
      const days = getCalendarRangeDays(range);
      const res = await getLearningStatsDaily(
        deviceId,
        days,
        this.activeContextParams(),
      );
      const points = res.data || [];

      if (range === "today") {
        // 今日不画单柱图,用摘要数据（wxml 里还引用 dashboard.continuousDays）
        const today = points[points.length - 1];
        this.setData({
          todayMinutes: today?.durationMinutes ?? 0,
          todaySessions: today?.sessionCount ?? 0,
          trendBars: [],
        });
      } else if (range === "month") {
        // 月视图按周聚合,避免 30 根柱与日期标签溢出
        const buckets = aggregateDailyToWeekly(points);
        const heights = scaleBarHeights(
          buckets.map((b) => b.durationMinutes),
          160,
          120,
        );
        this.setData({
          trendBars: buckets.map((b, i) => ({
            label: b.label,
            value: b.durationMinutes,
            height: heights[i],
          })),
        });
      } else {
        const heights = scaleBarHeights(
          points.map((p) => p.durationMinutes),
          160,
          60,
        );
        this.setData({
          trendBars: points.map((p, i) => ({
            label: p.date,
            value: p.durationMinutes,
            height: heights[i],
          })),
        });
      }
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
      const topics = res.data || [];
      // 语境选择器数据源：全部练过的语境;首项=当前配置
      const contextOptions = buildContextOptions(topics);
      this.setData({
        topics,
        contextOptions,
        contextActions: contextOptions.map((o) => ({
          name: o.label,
          contextKey: o.key,
        })),
        contextLabel: contextOptions[0]?.label ?? "当前语境",
      });
    } catch (error) {
      wx.showToast({ title: "主题加载失败", icon: "none" });
    } finally {
      this.setLoading("topics", false);
    }
  },

  onOpenContextSheet() {
    if (this.data.contextOptions.length === 0) return;
    this.setData({ showContextSheet: true });
  },

  onCloseContextSheet() {
    this.setData({ showContextSheet: false });
  },

  /**
   * 切换查看语境：只重拉统计数据,绝不修改设备配置（查看不打断练习）。
   */
  onContextSelect(event: { detail: { contextKey?: string } }) {
    const key = event.detail.contextKey ?? "default";
    const option = this.data.contextOptions.find((o) => o.key === key);
    if (!option || key === this.data.activeContextKey) {
      this.setData({ showContextSheet: false });
      return;
    }

    const isFreeChat = !!option.params.mode;
    this.setData({
      showContextSheet: false,
      activeContextKey: key,
      contextLabel: option.label,
      isFreeChatContext: isFreeChat,
      trendCaption: isFreeChat
        ? "单位:分钟 · 自由对话"
        : "单位:分钟 · 教材学习",
    });

    this.loadMetrics(this.data.deviceId, this.data.activeRange);
    this.loadTrend(this.data.deviceId, this.data.activeRange);
    this.loadActivities(this.data.deviceId, true);
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

  async loadActivities(deviceId: string, reset = false) {
    if (reset) {
      this.setData({ page: 1, activities: [] });
    }
    this.setLoading("activities", true);
    try {
      const res = await getLearningStatsActivities(
        deviceId,
        this.data.page,
        this.data.pageSize,
        this.data.activeRange,
        this.activeContextParams(),
      );
      const { items, total } = res.data;
      const formatted = this.buildActivityViews(items);
      this.setData({
        activities: reset ? formatted : this.data.activities.concat(formatted),
        // 后端按日分页,total = 活跃日数
        hasMore: this.data.page * this.data.pageSize < total,
        page: this.data.page,
      });
    } catch (error) {
      wx.showToast({ title: "动态加载失败", icon: "none" });
    } finally {
      this.setLoading("activities", false);
    }
  },

  /**
   * 把后端动态事件映射为展示视图（图标 + 文案）
   */
  buildActivityViews(days: LearningStatsActivityDay[]): ActivityDayView[] {
    return days.map((day) => ({
      date: day.date,
      views: day.events.map((event) => {
        if (event.type === "streak") {
          return {
            icon: "fire-o",
            text: `连续学习 ${event.streakDays} 天`,
            sub: "坚持就是进步",
          };
        }
        if (event.type === "unlock") {
          return {
            icon: "medal-o",
            text: `解锁新单元 ${event.unitName ?? event.unitId ?? ""}`,
            sub: event.textbookName ?? "",
          };
        }
        const title =
          event.mode === "free_chat"
            ? "自由对话"
            : [event.textbookName, event.unitName]
                .filter(Boolean)
                .join(" · ") || "学习练习";
        return {
          icon: "records-o",
          text: title,
          sub: `${event.turnCount ?? 0} 轮对话`,
        };
      }),
    }));
  },

  onRangeChange(event: { detail: { name: string } }) {
    const range = event.detail.name as "today" | "week" | "month";
    this.setData({ activeRange: range });
    // 指标卡、趋势、学习动态都随 tab 切换
    this.loadMetrics(this.data.deviceId, range);
    this.loadTrend(this.data.deviceId, range);
    this.loadActivities(this.data.deviceId, true);
  },

  async onLoadMore() {
    if (!this.data.hasMore || this.data.loading.activities) return;
    this.setData({ page: this.data.page + 1 });
    await this.loadActivities(this.data.deviceId);
  },
});
