"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../api/api");
const date_1 = require("../../utils/date");
const learning_analytics_1 = require("./learning-analytics");
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
    },
    activeRange: "week",
    dashboard: {},
    trendBars: [],
    topics: [],
    timeline: [],
    insights: [],
    health: {},
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
  onPullDownRefresh() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ page: 1 });
      yield this.loadAll();
      wx.stopPullDownRefresh();
    });
  },
  setLoading(key, value) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },
  /**
   * 切换时间范围：今日 / 本周 / 本月
   */
  onRangeChange(event) {
    const range = event.detail.name;
    this.setData({ activeRange: range });
    this.loadAll();
  },
  /**
   * 加载全部区块
   */
  loadAll() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ page: 1 });
      yield Promise.all([
        this.loadSummary(),
        this.loadTrend(),
        this.loadTopics(),
        this.loadTimeline(true),
        this.loadInsights(),
        this.loadHealth(),
      ]);
    });
  },
  /**
   * 加载顶部汇总卡 + 孩子设备
   */
  loadSummary() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("summary", true);
      this.setLoading("devices", true);
      try {
        const res = yield (0, api_1.getLearningStatsDashboard)(
          undefined,
          this.data.activeRange,
        );
        this.setData({ dashboard: res.data });
        yield this.enrichDeviceStatuses(res.data.devices);
      } catch (error) {
        wx.showToast({ title: "汇总加载失败", icon: "none" });
      } finally {
        this.setLoading("summary", false);
        this.setLoading("devices", false);
      }
    });
  },
  /**
   * 用 getDeviceStatus 实时校正设备状态，保证与设备列表页一致。
   * 失败时保留 dashboard 原有状态，不影响页面可用性。
   */
  enrichDeviceStatuses(devices) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!devices || devices.length === 0) return;
      const statusMap = {};
      yield Promise.all(
        devices.map((device) =>
          __awaiter(this, void 0, void 0, function* () {
            try {
              const res = yield (0, api_1.getDeviceStatus)(device.deviceId);
              statusMap[device.deviceId] = res.data;
            } catch (error) {
              // 状态校正失败时保留 dashboard 原状态
            }
          }),
        ),
      );
      const enriched = (0, learning_analytics_1.enrichDevicesWithStatus)(
        devices,
        statusMap,
      );
      this.setData({
        dashboard: Object.assign(Object.assign({}, this.data.dashboard), {
          devices: enriched,
        }),
      });
    });
  },
  /**
   * 加载学习趋势
   */
  loadTrend() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("trend", true);
      try {
        const days = this.getTrendDays();
        const res = yield (0, api_1.getLearningStatsDaily)(undefined, days);
        this.setData({
          trendBars: (0, learning_analytics_1.aggregateFamilyTrend)(
            res.data,
            this.data.activeRange,
          ),
        });
      } catch (error) {
        wx.showToast({ title: "趋势加载失败", icon: "none" });
      } finally {
        this.setLoading("trend", false);
      }
    });
  },
  /**
   * 根据当前范围返回趋势图所需天数
   */
  getTrendDays() {
    const map = {
      today: 1,
      week: 7,
      month: 30,
    };
    return map[this.data.activeRange];
  },
  /**
   * 加载主题分布
   */
  loadTopics() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("topics", true);
      try {
        const res = yield (0, api_1.getLearningStatsTopics)();
        this.setData({ topics: res.data });
      } catch (error) {
        wx.showToast({ title: "主题加载失败", icon: "none" });
      } finally {
        this.setLoading("topics", false);
      }
    });
  },
  /**
   * 加载 AI 学习洞察
   * 后端不可用时，使用前端兜底规则生成。
   */
  loadInsights() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("insights", true);
      try {
        const res = yield (0, api_1.getLearningStatsInsights)(
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
    });
  },
  /**
   * 加载学习健康度
   * 后端不可用时，使用前端兜底计算。
   */
  loadHealth() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("health", true);
      try {
        const res = yield (0, api_1.getLearningStatsHealth)(
          undefined,
          this.data.activeRange,
        );
        this.setData({ health: res.data });
      } catch (error) {
        this.setData({ health: this.buildFallbackHealth() });
      } finally {
        this.setLoading("health", false);
      }
    });
  },
  /**
   * 基于当前已有数据生成兜底洞察
   */
  buildFallbackInsights() {
    const { dashboard, trendBars, topics, activeRange } = this.data;
    if (!dashboard.devices) return [];
    return (0, learning_analytics_1.generateFallbackInsights)({
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
  buildFallbackHealth() {
    const { dashboard, trendBars, topics, activeRange } = this.data;
    return (0, learning_analytics_1.calculateHealthScore)({
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
  loadTimeline() {
    return __awaiter(this, arguments, void 0, function* (reset = false) {
      if (reset) {
        this.setData({ page: 1, timeline: [] });
      }
      this.setLoading("timeline", true);
      try {
        const res = yield (0, api_1.getLearningStatsTimeline)(
          undefined,
          this.data.page,
          this.data.pageSize,
        );
        const { items, total } = res.data;
        const formatted = items.map((item) =>
          Object.assign(Object.assign({}, item), {
            displayTime: (0, date_1.formatChatTime)(item.createdAt),
          }),
        );
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
    });
  },
  /**
   * 加载更多时间线
   */
  onLoadMore() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.hasMore || this.data.loading.timeline) return;
      this.setData({ page: this.data.page + 1 });
      yield this.loadTimeline();
    });
  },
  /**
   * 点击设备汇总卡：进入单设备智能分析
   */
  onDeviceCardTap(event) {
    const { deviceId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-analysis/device-analysis?id=${deviceId}`,
    });
  },
});
