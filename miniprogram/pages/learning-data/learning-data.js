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
const learning_data_utils_1 = require("./learning-data.utils");
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
    },
    dashboard: {},
    trend: [],
    topics: [],
    unitProgress: [],
    timeline: [],
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
  onPullDownRefresh() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ page: 1 });
      yield Promise.all([
        this.loadSummary(),
        this.loadTrend(),
        this.loadTopics(),
        this.loadTimeline(true),
      ]);
      wx.stopPullDownRefresh();
    });
  },
  setLoading(key, value) {
    this.setData({
      [`loading.${key}`]: value,
    });
  },
  /**
   * 加载顶部汇总卡 + 孩子设备
   */
  loadSummary() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      this.setLoading("summary", true);
      this.setLoading("devices", true);
      try {
        const res = yield (0, api_1.getLearningStatsDashboard)();
        this.setData({ dashboard: res.data });
        const firstDeviceId =
          (_a = res.data.devices[0]) === null || _a === void 0
            ? void 0
            : _a.deviceId;
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
    });
  },
  /**
   * 加载近 7 天趋势
   */
  loadTrend() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setLoading("trend", true);
      try {
        const res = yield (0, api_1.getLearningStatsDaily)(undefined, 7);
        this.setData({ trend: res.data });
      } catch (error) {
        wx.showToast({ title: "趋势加载失败", icon: "none" });
      } finally {
        this.setLoading("trend", false);
      }
    });
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
   * 加载单元进度
   */
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
