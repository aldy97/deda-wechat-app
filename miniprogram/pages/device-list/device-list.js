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
 * 设备列表页
 * 展示用户绑定的设备卡片，点击卡片进入控制面板。
 */
Page({
    data: {
        loading: true,
        devices: [],
    },
    onLoad() {
        this.fetchDeviceList();
    },
    onShow() {
        // 每次显示页面时刷新列表，方便从控制页返回后看到最新状态
        this.fetchDeviceList();
    },
    /**
     * 拉取设备列表
     */
    fetchDeviceList() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.getDeviceList)();
                this.setData({ devices: res.data });
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
     * 查看对话：跳转对话记录页
     */
    onViewChat(event) {
        const { id } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/chat-history/chat-history?id=${id}`,
        });
    },
    /**
     * 设置入口（占位）
     */
    onSettingsTap() {
        // 设置功能后续迭代实现
    },
    /**
     * 下拉刷新
     */
    onPullDownRefresh() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchDeviceList();
            wx.stopPullDownRefresh();
        });
    },
});
