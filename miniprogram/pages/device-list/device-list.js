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
/** 缓存键 */
const CACHE_KEY = 'device_list_cache';
/** 缓存有效期：5 分钟 */
const CACHE_TTL = 5 * 60 * 1000;
/**
 * 设备列表页
 * 展示用户绑定的设备卡片，点击卡片进入控制面板。
 *
 * 加载策略：
 * 1. 优先读取本地缓存并立即渲染，减少等待时间。
 * 2. 无缓存或缓存过期时显示 loading。
 * 3. 每次进入页面都会在后台静默刷新，保证数据最新。
 */
Page({
    data: {
        loading: true,
        devices: [],
    },
    onLoad() {
        this.loadDeviceList();
    },
    onShow() {
        // 每次显示页面时后台刷新，方便从控制页/设置页返回后看到最新状态
        this.loadDeviceList();
    },
    /**
     * 加载设备列表：优先缓存，后台刷新
     */
    loadDeviceList() {
        const cache = this.getCache();
        const cacheValid = cache && Date.now() - cache.timestamp < CACHE_TTL;
        if (cacheValid) {
            // 有有效缓存：先渲染缓存，再静默刷新
            this.setData({ devices: cache.data, loading: false });
            this.fetchDeviceList({ silent: true });
        }
        else {
            // 无缓存或已过期：显示 loading 重新加载
            this.fetchDeviceList({ silent: false });
        }
    },
    /**
     * 读取本地缓存
     */
    getCache() {
        try {
            const cache = wx.getStorageSync(CACHE_KEY);
            return cache || null;
        }
        catch (error) {
            return null;
        }
    },
    /**
     * 写入本地缓存
     */
    saveCache(devices) {
        try {
            wx.setStorageSync(CACHE_KEY, { data: devices, timestamp: Date.now() });
        }
        catch (error) {
            console.warn('[device-list] 缓存写入失败', error);
        }
    },
    /**
     * 清除本地缓存
     */
    clearCache() {
        try {
            wx.removeStorageSync(CACHE_KEY);
        }
        catch (error) {
            console.warn('[device-list] 缓存清除失败', error);
        }
    },
    /**
     * 判断两个设备列表是否相等（仅比较关键字段，避免无意义刷新）
     */
    isSameDevices(a, b) {
        if (a.length !== b.length)
            return false;
        return a.every((device, index) => {
            const other = b[index];
            return (device.id === other.id &&
                device.name === other.name &&
                device.status === other.status &&
                device.battery === other.battery &&
                device.isCharging === other.isCharging);
        });
    },
    /**
     * 拉取设备列表，并并发获取每个设备的状态/电量
     * @param silent true 表示后台静默刷新，不显示 loading
     */
    fetchDeviceList() {
        return __awaiter(this, arguments, void 0, function* (options = { silent: false }) {
            if (!options.silent) {
                this.setData({ loading: true });
            }
            try {
                const listRes = yield (0, api_1.getDeviceList)();
                const devices = listRes.data.map((device) => (Object.assign(Object.assign({}, device), { statusLoading: true })));
                // 并发获取每个设备的状态/电量
                yield Promise.all(devices.map((device) => this.fetchDeviceStatus(device.id, devices)));
                // 仅当数据发生变化时才更新 UI，避免闪烁
                if (!this.isSameDevices(this.data.devices, devices)) {
                    this.setData({ devices });
                }
                this.saveCache(devices);
            }
            catch (error) {
                // 静默刷新失败时，若已有缓存则不打扰用户；否则提示错误
                if (!options.silent || this.data.devices.length === 0) {
                    wx.showToast({ title: '加载失败', icon: 'none' });
                }
            }
            finally {
                if (!options.silent) {
                    this.setData({ loading: false });
                }
            }
        });
    },
    /**
     * 获取单个设备状态/电量
     * @param deviceId 设备 ID
     * @param devicesRef 设备列表引用，用于更新状态
     */
    fetchDeviceStatus(deviceId, devicesRef) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield (0, api_1.getDeviceStatus)(deviceId);
                const statusData = res.data;
                const devices = (devicesRef || this.data.devices).map((device) => {
                    if (device.id !== deviceId)
                        return device;
                    return Object.assign(Object.assign({}, device), { status: statusData.status, battery: statusData.battery, isCharging: statusData.isCharging, lastActiveAt: statusData.lastActiveAt, statusLoading: false });
                });
                if (devicesRef) {
                    // 直接修改引用，避免频繁 setData
                    devicesRef.length = 0;
                    devicesRef.push(...devices);
                }
                else {
                    this.setData({ devices });
                }
            }
            catch (error) {
                // 单个设备状态获取失败，不影响其他设备
                const devices = (devicesRef || this.data.devices).map((device) => {
                    if (device.id !== deviceId)
                        return device;
                    return Object.assign(Object.assign({}, device), { statusLoading: false });
                });
                if (devicesRef) {
                    devicesRef.length = 0;
                    devicesRef.push(...devices);
                }
                else {
                    this.setData({ devices });
                }
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
