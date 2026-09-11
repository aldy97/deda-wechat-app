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
/**
 * 单设备智能分析页
 * 展示绑定该设备的孩子个人学情：核心指标、口语维度、教材进度、最近记录。
 */
Page({
    data: {
        deviceId: '',
        loading: true,
        profile: {},
        analysis: {},
        textbooks: [],
        trend: [],
        activeRange: 'week',
        expandedModules: {},
    },
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || 'D001';
        this.setData({ deviceId });
        this.loadAll(deviceId, this.data.activeRange);
    },
    onPullDownRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadAll(this.data.deviceId, this.data.activeRange);
            wx.stopPullDownRefresh();
        });
    },
    /**
     * 加载页面全部数据
     */
    loadAll(deviceId, range) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const [profileRes, analysisRes, textbooksRes, trendRes] = yield Promise.all([
                    (0, api_1.getChildProfile)(deviceId),
                    (0, api_1.getDeviceAnalysis)(deviceId, range),
                    (0, api_1.getDeviceTextbookProgress)(deviceId),
                    (0, api_1.getDeviceTrend)(deviceId, 7),
                ]);
                this.setData({
                    profile: profileRes.data,
                    analysis: analysisRes.data,
                    textbooks: textbooksRes.data,
                    trend: trendRes.data,
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
    /**
     * 切换时间范围
     */
    onRangeChange(event) {
        const range = event.detail.name;
        this.setData({ activeRange: range });
        this.loadAll(this.data.deviceId, range);
    },
    /**
     * 展开/收起教材模块
     */
    onToggleModule(event) {
        const { moduleId } = event.currentTarget.dataset;
        const expandedModules = Object.assign({}, this.data.expandedModules);
        expandedModules[moduleId] = !expandedModules[moduleId];
        this.setData({ expandedModules });
    },
    /**
     * 点击单元：跳转该模块的对话记录
     */
    onUnitTap(event) {
        const { textbookId, moduleId, unitId } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/chat-history/chat-history?deviceId=${this.data.deviceId}&textbookId=${textbookId}&moduleId=${moduleId}&unitId=${unitId}`,
        });
    },
    /**
     * 点击最近记录：跳转对话记录
     */
    onRecordTap(event) {
        const { recordId } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/chat-history/chat-history?deviceId=${this.data.deviceId}&recordId=${recordId}`,
        });
    },
});
