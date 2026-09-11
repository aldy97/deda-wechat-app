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
 * 设备控制面板页
 * 展示设备开关、音量、模式等控制项，所有操作调用模拟接口。
 */
Page({
    data: {
        deviceId: '',
        loading: true,
        device: {},
    },
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || 'D001';
        this.setData({ deviceId });
        this.fetchDeviceData(deviceId);
    },
    /**
     * 拉取设备控制数据
     */
    fetchDeviceData(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.getDeviceControl)(deviceId);
                this.setData({ device: res.data });
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
     * 电源开关切换
     */
    onPowerChange(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const power = event.detail;
            this.setData({ 'device.power': power });
            yield this.updateDevice({ power });
        });
    },
    /**
     * 音量滑块变化
     */
    onVolumeChange(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const volume = event.detail;
            this.setData({ 'device.volume': volume });
        });
    },
    /**
     * 音量滑块拖动结束，提交更新
     */
    onVolumeDragEnd(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const volume = event.detail;
            yield this.updateDevice({ volume });
        });
    },
    /**
     * 模式切换
     */
    onModeChange(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const mode = event.detail;
            this.setData({ 'device.mode': mode });
            yield this.updateDevice({ mode });
        });
    },
    /**
     * 更新设备状态
     */
    updateDevice(partial) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield (0, api_1.updateDeviceControl)(this.data.deviceId, partial);
                this.setData({ device: res.data });
            }
            catch (error) {
                wx.showToast({ title: '更新失败', icon: 'none' });
            }
        });
    },
});
