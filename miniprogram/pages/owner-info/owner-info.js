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
const date_1 = require("../../utils/date");
/**
 * 主人信息页
 * 展示并编辑当前设备对应的孩子名字与生日。
 */
Page({
    data: {
        deviceId: '',
        /** 页面加载中 */
        loading: true,
        /** 保存中 */
        saving: false,
        /** 表单数据 */
        form: {
            name: '',
            birthday: '',
        },
        /** 是否显示日期选择弹窗 */
        showDatePicker: false,
        /** 日期选择器当前值的时间戳 */
        currentDate: new Date('2020-05-20').getTime(),
    },
    onLoad(options) {
        const deviceId = (options === null || options === void 0 ? void 0 : options.id) || '';
        this.setData({ deviceId });
        this.fetchOwnerInfo(deviceId);
    },
    /**
     * 获取主人信息
     */
    fetchOwnerInfo(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setData({ loading: true });
            try {
                const res = yield (0, api_1.getOwnerInfo)(deviceId);
                const { name, birthday } = res.data;
                this.setData({
                    'form.name': name,
                    'form.birthday': birthday,
                    currentDate: birthday ? new Date(birthday).getTime() : new Date('2020-05-20').getTime(),
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
     * 名字输入变化
     */
    onNameChange(event) {
        this.setData({ 'form.name': event.detail });
    },
    /**
     * 打开日期选择器
     */
    onOpenDatePicker() {
        const currentDate = this.data.form.birthday
            ? new Date(this.data.form.birthday).getTime()
            : new Date('2020-05-20').getTime();
        this.setData({ showDatePicker: true, currentDate });
    },
    /**
     * 关闭日期选择器
     */
    onCloseDatePicker() {
        this.setData({ showDatePicker: false });
    },
    /**
     * 日期选择器值变化
     */
    onDateChange(event) {
        const timestamp = event.detail;
        const date = (0, date_1.formatDate)(timestamp, 'YYYY-MM-DD');
        this.setData({ 'form.birthday': date });
    },
    /**
     * 确认日期选择
     */
    onDateConfirm(event) {
        const timestamp = event.detail;
        const date = (0, date_1.formatDate)(timestamp, 'YYYY-MM-DD');
        this.setData({
            'form.birthday': date,
            showDatePicker: false,
        });
    },
    /**
     * 保存主人信息
     */
    onSave() {
        return __awaiter(this, void 0, void 0, function* () {
            const { name } = this.data.form;
            if (!name.trim()) {
                wx.showToast({ title: '请输入名字', icon: 'none' });
                return;
            }
            this.setData({ saving: true });
            try {
                yield (0, api_1.updateOwnerInfo)(this.data.deviceId, this.data.form);
                wx.showToast({ title: '保存成功', icon: 'success' });
                setTimeout(() => {
                    wx.navigateBack();
                }, 800);
            }
            catch (error) {
                wx.showToast({ title: '保存失败', icon: 'none' });
                this.setData({ saving: false });
            }
        });
    },
});
