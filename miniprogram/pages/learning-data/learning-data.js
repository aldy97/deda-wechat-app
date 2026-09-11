"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../api/api");
const pagination_1 = require("../../utils/pagination");
/**
 * 学习 Tab - 家庭全览页
 * 展示家长账号下所有设备的跨设备学习汇总与动态时间线。
 */
Page({
    data: {
        loading: true,
        overview: {},
        trend: [],
        timeline: [],
        page: 1,
        pageSize: 10,
        hasMore: true,
    },
    // 本地缓存全部时间线数据
    privateAllTimeline: [],
    onLoad() {
        this.loadAll();
    },
    onPullDownRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadAll();
            wx.stopPullDownRefresh();
        });
    },
    /**
     * 加载页面全部数据
     */
    loadAll() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const [overviewRes, trendRes] = yield Promise.all([
                    (0, api_1.getFamilyOverview)(),
                    (0, api_1.getFamilyTrend)(7),
                ]);
                this.setData({
                    overview: overviewRes.data,
                    trend: trendRes.data,
                });
                yield this.loadTimeline(true);
            }
            catch (error) {
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
            finally {
                this.setData({ loading: false });
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
                this.privateAllTimeline = [];
            }
            try {
                if (this.privateAllTimeline.length === 0) {
                    const res = yield (0, api_1.getFamilyTimeline)(1, 100);
                    this.privateAllTimeline = res.data;
                }
                const result = (0, pagination_1.paginate)(this.privateAllTimeline, this.data.page, this.data.pageSize);
                this.setData({
                    timeline: reset ? result.list : this.data.timeline.concat(result.list),
                    hasMore: result.hasMore,
                    page: result.page,
                });
            }
            catch (error) {
                wx.showToast({ title: '时间线加载失败', icon: 'none' });
            }
        });
    },
    /**
     * 加载更多时间线
     */
    onLoadMore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.data.hasMore || this.data.loading)
                return;
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
