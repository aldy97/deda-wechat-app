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
 * 对话记录页
 * 采用即时通讯式交互：进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 */
Page({
    data: {
        deviceId: '',
        loading: false,
        records: [],
        hasMore: true,
        loadedCount: 0,
        pageSize: 20,
        initialLoaded: false,
        // 用于 scroll-view 的 scroll-into-view，控制滚动位置
        scrollIntoView: '',
    },
    // 本地缓存全部对话记录（按时间正序：旧 → 新）
    privateAllRecords: [],
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || '';
        this.setData({ deviceId });
        this.loadInitialRecords();
    },
    /**
     * 初始加载：拉取全部数据到本地，取最新 N 条并滚动到底部
     */
    loadInitialRecords() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.getChatRecords)(1, 100);
                this.privateAllRecords = res.data;
                const result = (0, pagination_1.paginateFromEnd)(this.privateAllRecords, 0, this.data.pageSize);
                this.setData({
                    records: result.list,
                    hasMore: result.hasMore,
                    loadedCount: result.loadedCount,
                    initialLoaded: true,
                    scrollIntoView: 'msg-last',
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
     * 向上滚动到顶部时加载更早消息
     */
    onScrollToUpper() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.data.hasMore || this.data.loading)
                return;
            // 记录当前最顶部消息 ID，加载完成后回滚到该位置，避免列表跳动
            const anchorMessageId = ((_a = this.data.records[0]) === null || _a === void 0 ? void 0 : _a.id) || '';
            this.setData({ loading: true, scrollIntoView: '' });
            // 模拟 API 调用延迟
            yield new Promise((resolve) => setTimeout(resolve, 600));
            try {
                const result = (0, pagination_1.paginateFromEnd)(this.privateAllRecords, this.data.loadedCount, this.data.pageSize);
                this.setData({
                    records: result.list.concat(this.data.records),
                    hasMore: result.hasMore,
                    loadedCount: result.loadedCount,
                    scrollIntoView: anchorMessageId ? `msg-${anchorMessageId}` : '',
                });
            }
            catch (error) {
                wx.showToast({ title: '加载失败', icon: 'none' });
            }
            finally {
                this.setData({ loading: false });
            }
        });
    },
});
