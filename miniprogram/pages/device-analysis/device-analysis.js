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
      timeline: true,
    },
    profile: {},
    dashboard: {},
    trend: [],
    topics: [],
    unitProgress: [],
    timeline: [],
    activeRange: "week",
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
        this.loadMetrics(deviceId),
        this.loadTrend(deviceId, range),
        this.loadTopics(deviceId),
        this.loadUnitProgress(deviceId),
        this.loadTimeline(deviceId, true),
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
  loadMetrics(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("metrics", true);
      try {
        const res = yield (0, api_1.getLearningStatsDashboard)(deviceId);
        this.setData({ dashboard: res.data });
      } catch (error) {
        wx.showToast({ title: "指标加载失败", icon: "none" });
      } finally {
        this.setLoading("metrics", false);
      }
    });
  },
  loadTrend(deviceId, range) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("trend", true);
      try {
        const days = (0, learning_data_utils_1.getRangeDays)(range);
        const res = yield (0, api_1.getLearningStatsDaily)(deviceId, days);
        this.setData({ trend: res.data });
      } catch (error) {
        wx.showToast({ title: "趋势加载失败", icon: "none" });
      } finally {
        this.setLoading("trend", false);
      }
    });
  },
  loadTopics(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("topics", true);
      try {
        const res = yield (0, api_1.getLearningStatsTopics)(deviceId);
        this.setData({ topics: res.data });
      } catch (error) {
        wx.showToast({ title: "主题加载失败", icon: "none" });
      } finally {
        this.setLoading("topics", false);
      }
    });
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
  loadTimeline(deviceId_1) {
    return __awaiter(
      this,
      arguments,
      void 0,
      function* (deviceId, reset = false) {
        if (reset) {
          this.setData({ page: 1, timeline: [] });
        }
        this.setLoading("timeline", true);
        try {
          const res = yield (0, api_1.getLearningStatsTimeline)(
            deviceId,
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
          wx.showToast({ title: "动态加载失败", icon: "none" });
        } finally {
          this.setLoading("timeline", false);
        }
      },
    );
  },
  onRangeChange(event) {
    const range = event.detail.name;
    this.setData({ activeRange: range });
    this.loadTrend(this.data.deviceId, range);
  },
  onLoadMore() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.hasMore || this.data.loading.timeline) return;
      this.setData({ page: this.data.page + 1 });
      yield this.loadTimeline(this.data.deviceId);
    });
  },
});
