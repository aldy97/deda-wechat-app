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
     * 拉取设备列表，并并发获取每个设备的状态/电量
     */
    fetchDeviceList() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const listRes = yield (0, api_1.getDeviceList)();
                const devices = listRes.data.map((device) => (Object.assign(Object.assign({}, device), { statusLoading: true })));
                this.setData({ devices });
                // 并发获取每个设备的状态/电量
                yield Promise.all(devices.map((device) => this.fetchDeviceStatus(device.id)));
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
     * 获取单个设备状态/电量
     */
    fetchDeviceStatus(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield (0, api_1.getDeviceStatus)(deviceId);
                const statusData = res.data;
                const devices = this.data.devices.map((device) => {
                    if (device.id !== deviceId)
                        return device;
                    return Object.assign(Object.assign({}, device), { status: statusData.status, battery: statusData.battery, isCharging: statusData.isCharging, lastActiveAt: statusData.lastActiveAt, statusLoading: false });
                });
                this.setData({ devices });
            }
            catch (error) {
                // 单个设备状态获取失败，不影响其他设备
                const devices = this.data.devices.map((device) => {
                    if (device.id !== deviceId)
                        return device;
                    return Object.assign(Object.assign({}, device), { statusLoading: false });
                });
                this.setData({ devices });
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
     * 智能分析：跳转单设备智能分析页
     */
    onViewAnalysis(event) {
        const { id } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/device-analysis/device-analysis?id=${id}`,
        });
    },
    /**
     * 设置入口：跳转设备设置页
     */
    onSettingsTap(event) {
        const { id } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/device-setting/device-setting?id=${id}`,
        });
    },
    /**
     * 切换模式：跳转切换模式页
     */
    onSwitchMode(event) {
        const { id } = event.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/switch-mode/switch-mode?id=${id}`,
        });
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
