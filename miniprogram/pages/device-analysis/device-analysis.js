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
const learning_data_utils_1 = require("../learning-data/learning-data.utils");
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
    },
    profile: {},
    dashboard: {},
    trendBars: [],
    todayMinutes: 0,
    todaySessions: 0,
    practiceDisplay: 0,
    topics: [],
    unitProgress: [],
    activities: [],
    activeRange: "week",
    contextOptions: [],
    contextActions: [],
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
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "";
    this.setData({ deviceId });
    if (!deviceId) {
      wx.showToast({ title: "缺少设备 ID", icon: "none" });
      return;
    }
    this.loadAll(deviceId, this.data.activeRange);
  },
  onPullDownRefresh() {
    return __awaiter(this, void 0, void 0, function* () {
      yield this.loadAll(this.data.deviceId, this.data.activeRange);
      wx.stopPullDownRefresh();
    });
  },
  loadAll(deviceId, range) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ page: 1 });
      yield Promise.all([
        this.loadProfile(deviceId),
        this.loadMetrics(deviceId, range),
        this.loadTrend(deviceId, range),
        this.loadTopics(deviceId),
        this.loadUnitProgress(deviceId),
        this.loadActivities(deviceId, true),
      ]);
    });
  },
  setLoading(key, value) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },
  loadProfile(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("profile", true);
      try {
        const res = yield (0, api_1.getOwnerInfo)(deviceId);
        this.setData({ profile: res.data || {} });
      } catch (error) {
        wx.showToast({ title: "档案加载失败", icon: "none" });
      } finally {
        this.setLoading("profile", false);
      }
    });
  },
  /**
   * 当前选中语境的显式参数;default = 空对象,由后端按设备当前配置族兜底。
   * 查看任何语境都是只读操作,不修改设备配置。
   */
  activeContextParams() {
    var _a;
    const option = this.data.contextOptions.find(
      (o) => o.key === this.data.activeContextKey,
    );
    return (_a =
      option === null || option === void 0 ? void 0 : option.params) !== null &&
      _a !== void 0
      ? _a
      : {};
  },
  loadMetrics(deviceId, range) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      this.setLoading("metrics", true);
      try {
        const res = yield (0, api_1.getLearningStatsDashboard)(
          deviceId,
          range,
          this.activeContextParams(),
        );
        const d = res.data;
        this.setData({
          dashboard: d,
          // 带 range 时后端返回轮数;缺省回落活跃场次
          practiceDisplay:
            (_b =
              (_a = d.practiceCount) !== null && _a !== void 0
                ? _a
                : d.totalSessions) !== null && _b !== void 0
              ? _b
              : 0,
        });
      } catch (error) {
        wx.showToast({ title: "指标加载失败", icon: "none" });
      } finally {
        this.setLoading("metrics", false);
      }
    });
  },
  loadTrend(deviceId, range) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      this.setLoading("trend", true);
      try {
        const days = (0, learning_data_utils_1.getCalendarRangeDays)(range);
        const res = yield (0, api_1.getLearningStatsDaily)(
          deviceId,
          days,
          this.activeContextParams(),
        );
        const points = res.data || [];
        if (range === "today") {
          // 今日不画单柱图,用摘要数据（wxml 里还引用 dashboard.continuousDays）
          const today = points[points.length - 1];
          this.setData({
            todayMinutes:
              (_a =
                today === null || today === void 0
                  ? void 0
                  : today.durationMinutes) !== null && _a !== void 0
                ? _a
                : 0,
            todaySessions:
              (_b =
                today === null || today === void 0
                  ? void 0
                  : today.sessionCount) !== null && _b !== void 0
                ? _b
                : 0,
            trendBars: [],
          });
        } else if (range === "month") {
          // 月视图按周聚合,避免 30 根柱与日期标签溢出
          const buckets = (0, learning_data_utils_1.aggregateDailyToWeekly)(
            points,
          );
          const heights = (0, learning_data_utils_1.scaleBarHeights)(
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
          const heights = (0, learning_data_utils_1.scaleBarHeights)(
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
    });
  },
  loadTopics(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      this.setLoading("topics", true);
      try {
        const res = yield (0, api_1.getLearningStatsTopics)(deviceId);
        const topics = res.data || [];
        // 语境选择器数据源：全部练过的语境;首项=当前配置
        const contextOptions = (0, learning_data_utils_1.buildContextOptions)(
          topics,
        );
        this.setData({
          topics,
          contextOptions,
          contextActions: contextOptions.map((o) => ({
            name: o.label,
            contextKey: o.key,
          })),
          contextLabel:
            (_b =
              (_a = contextOptions[0]) === null || _a === void 0
                ? void 0
                : _a.label) !== null && _b !== void 0
              ? _b
              : "当前语境",
        });
      } catch (error) {
        wx.showToast({ title: "主题加载失败", icon: "none" });
      } finally {
        this.setLoading("topics", false);
      }
    });
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
  onContextSelect(event) {
    var _a;
    const key =
      (_a = event.detail.contextKey) !== null && _a !== void 0 ? _a : "default";
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
  loadUnitProgress(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("unitProgress", true);
      try {
        const res = yield (0, api_1.getLearningStatsUnitProgress)(deviceId);
        this.setData({
          unitProgress: (0, learning_data_utils_1.groupUnitProgressByTextbook)(
            res.data,
          ),
        });
      } catch (error) {
        wx.showToast({ title: "单元进度加载失败", icon: "none" });
      } finally {
        this.setLoading("unitProgress", false);
      }
    });
  },
  loadActivities(deviceId_1) {
    return __awaiter(
      this,
      arguments,
      void 0,
      function* (deviceId, reset = false) {
        if (reset) {
          this.setData({ page: 1, activities: [] });
        }
        this.setLoading("activities", true);
        try {
          const res = yield (0, api_1.getLearningStatsActivities)(
            deviceId,
            this.data.page,
            this.data.pageSize,
            this.data.activeRange,
            this.activeContextParams(),
          );
          const { items, total } = res.data;
          const formatted = this.buildActivityViews(items);
          this.setData({
            activities: reset
              ? formatted
              : this.data.activities.concat(formatted),
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
    );
  },
  /**
   * 把后端动态事件映射为展示视图（图标 + 文案）
   */
  buildActivityViews(days) {
    return days.map((day) => ({
      date: day.date,
      views: day.events.map((event) => {
        var _a, _b, _c, _d;
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
            text: `解锁新单元 ${(_b = (_a = event.unitName) !== null && _a !== void 0 ? _a : event.unitId) !== null && _b !== void 0 ? _b : ""}`,
            sub: (_c = event.textbookName) !== null && _c !== void 0 ? _c : "",
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
          sub: `${(_d = event.turnCount) !== null && _d !== void 0 ? _d : 0} 轮对话`,
        };
      }),
    }));
  },
  onRangeChange(event) {
    const range = event.detail.name;
    this.setData({ activeRange: range });
    // 指标卡、趋势、学习动态都随 tab 切换
    this.loadMetrics(this.data.deviceId, range);
    this.loadTrend(this.data.deviceId, range);
    this.loadActivities(this.data.deviceId, true);
  },
  onLoadMore() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.hasMore || this.data.loading.activities) return;
      this.setData({ page: this.data.page + 1 });
      yield this.loadActivities(this.data.deviceId);
    });
  },
});
