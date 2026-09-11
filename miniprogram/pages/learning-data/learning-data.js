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
const date_1 = require("../../utils/date");
const pagination_1 = require("../../utils/pagination");
/**
 * 学习数据 & 对话记录页
 * 展示学习概览数据与对话记录列表，支持分页加载。
 */
Page({
    data: {
        loading: true,
        overview: {},
        records: [],
        page: 1,
        pageSize: 10,
        total: 0,
        hasMore: true,
        showDatePicker: false,
        currentDate: new Date().getTime(),
    },
    // 本地缓存全部对话记录，用于演示分页工具函数
    privateAllRecords: [],
    onLoad() {
        this.fetchOverview();
        this.fetchRecords(true);
    },
    /**
     * 获取学习概览
     */
    fetchOverview() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield (0, api_1.getLearningOverview)();
                this.setData({ overview: res.data });
            }
            catch (error) {
                console.error('[LearningData] 概览加载失败', error);
            }
        });
    },
    /**
     * 获取对话记录
     * @param reset 是否重置分页
     */
    fetchRecords() {
        return __awaiter(this, arguments, void 0, function* (reset = false) {
            if (reset) {
                this.setData({ loading: true, page: 1, records: [] });
                this.privateAllRecords = [];
            }
            try {
                // 首次加载时拉取全部模拟数据，后续使用本地分页工具函数
                if (this.privateAllRecords.length === 0) {
                    const res = yield (0, api_1.getChatRecords)(1, 100);
                    this.privateAllRecords = res.data;
                }
                const result = (0, pagination_1.paginate)(this.privateAllRecords, this.data.page, this.data.pageSize);
                this.setData({
                    records: reset ? result.list : this.data.records.concat(result.list),
                    total: result.total,
                    hasMore: result.hasMore,
                    page: result.page,
                });
            }
            catch (error) {
                wx.showToast({ title: '记录加载失败', icon: 'none' });
            }
            finally {
                this.setData({ loading: false });
            }
        });
    },
    /**
     * 加载更多对话记录
     */
    onLoadMore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.data.hasMore || this.data.loading)
                return;
            this.setData({ page: this.data.page + 1 });
            yield this.fetchRecords();
        });
    },
    /**
     * 下拉刷新
     */
    onPullDownRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([this.fetchOverview(), this.fetchRecords(true)]);
            wx.stopPullDownRefresh();
        });
    },
    /**
     * 打开日期选择器
     */
    onOpenDatePicker() {
        this.setData({ showDatePicker: true });
    },
    /**
     * 关闭日期选择器
     */
    onCloseDatePicker() {
        this.setData({ showDatePicker: false });
    },
    /**
     * 确认日期选择
     */
    onDateConfirm(event) {
        const date = new Date(event.detail);
        wx.showToast({
            title: `已选择 ${(0, date_1.formatDate)(date, 'YYYY-MM-DD')}`,
            icon: 'none',
        });
        this.setData({ showDatePicker: false });
    },
});
