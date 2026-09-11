"use strict";
/**
 * 小程序全局入口
 * 仅保留最基础的生命周期与全局数据，方便后续扩展登录态、设备信息等。
 */
App({
    globalData: {
        // 全局用户信息占位，登录成功后可在各页面读取
        userInfo: null,
    },
    onLaunch() {
        // 小程序启动时执行，可在此检查登录态、获取系统信息等
        console.log('[App] onLaunch');
    },
    onShow() {
        console.log('[App] onShow');
    },
    onHide() {
        console.log('[App] onHide');
    },
});
