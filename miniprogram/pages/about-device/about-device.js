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
 * 关于设备页
 * 展示设备编码、网络、固件等详细信息。
 * 点击设备编码可复制到剪贴板。
 */
Page({
    data: {
        deviceId: '',
        loading: true,
        info: {},
        /** 复制成功提示显示状态 */
        showCopyToast: false,
    },
    /** 提示隐藏定时器 */
    copyToastTimer: null,
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || '';
        this.setData({ deviceId });
        this.fetchDeviceAboutInfo(deviceId);
    },
    onUnload() {
        if (this.copyToastTimer) {
            clearTimeout(this.copyToastTimer);
        }
    },
    /**
     * 获取关于设备信息
     */
    fetchDeviceAboutInfo(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.getDeviceAboutInfo)(deviceId);
                this.setData({ info: res.data });
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
     * 点击设备编码：复制到剪贴板
     */
    onCopyDeviceCode() {
        const { deviceCode } = this.data.info;
        if (!deviceCode)
            return;
        wx.setClipboardData({
            data: deviceCode,
            success: () => {
                this.showCopySuccessToast();
            },
            fail: () => {
                wx.showToast({ title: '复制失败', icon: 'none' });
            },
        });
    },
    /**
     * 显示复制成功提示，3 秒后淡出隐藏
     */
    showCopySuccessToast() {
        if (this.copyToastTimer) {
            clearTimeout(this.copyToastTimer);
        }
        this.setData({ showCopyToast: true });
        this.copyToastTimer = setTimeout(() => {
            this.setData({ showCopyToast: false });
        }, 3000);
    },
});
