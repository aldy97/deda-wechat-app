"use strict";
/**
 * 设备设置页
 * 复刻设计图，所有按钮均无响应（占位）。
 */
Page({
    data: {
        deviceId: '',
    },
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || '';
        this.setData({ deviceId });
    },
    /**
     * 关于设备（占位）
     */
    onAboutDevice() {
        // TODO: 跳转关于设备页
    },
    /**
     * 主人信息（占位）
     */
    onOwnerInfo() {
        // TODO: 跳转主人信息页
    },
    /**
     * 说明书（占位）
     */
    onManual() {
        // TODO: 跳转说明书页
    },
    /**
     * 重新联网（占位）
     */
    onReconnect() {
        // TODO: 重新联网流程
    },
    /**
     * 删除设备（占位）
     */
    onDeleteDevice() {
        // TODO: 删除设备确认弹窗
    },
});
