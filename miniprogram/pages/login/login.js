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
 * 登录页
 * 提供手机号 + 验证码登录骨架，登录成功后跳转到设备列表。
 */
Page({
    data: {
        phone: '',
        code: '',
        loading: false,
        countdown: 0,
    },
    onLoad() {
        console.log('[Login] onLoad');
    },
    /**
     * 手机号输入
     */
    onPhoneChange(event) {
        this.setData({ phone: event.detail });
    },
    /**
     * 验证码输入
     */
    onCodeChange(event) {
        this.setData({ code: event.detail });
    },
    /**
     * 发送验证码（模拟）
     */
    onSendCode() {
        if (this.data.countdown > 0)
            return;
        wx.showToast({ title: '验证码已发送', icon: 'success' });
        this.setData({ countdown: 60 });
        const timer = setInterval(() => {
            this.setData({ countdown: this.data.countdown - 1 });
            if (this.data.countdown <= 0) {
                clearInterval(timer);
            }
        }, 1000);
    },
    /**
     * 登录提交
     */
    onLogin() {
        return __awaiter(this, void 0, void 0, function* () {
            const { phone, code } = this.data;
            if (!phone || !code) {
                wx.showToast({ title: '请填写完整信息', icon: 'none' });
                return;
            }
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.login)({ phone, code });
                wx.setStorageSync('token', res.data.token);
                wx.showToast({ title: '登录成功', icon: 'success' });
                setTimeout(() => {
                    wx.switchTab({ url: '/pages/device-list/device-list' });
                }, 800);
            }
            catch (error) {
                wx.showToast({ title: '登录失败', icon: 'none' });
            }
            finally {
                this.setData({ loading: false });
            }
        });
    },
});
