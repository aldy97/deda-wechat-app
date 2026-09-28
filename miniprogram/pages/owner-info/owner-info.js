"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../api/api");
const date_1 = require("../../utils/date");
/** 设备列表缓存键（与 device-list 保持一致） */
const DEVICE_LIST_CACHE_KEY = "device_list_cache";
/**
 * 主人信息页
 * 展示并编辑当前设备对应的孩子名字与生日。
 */
Page({
  data: {
    deviceId: "",
    /** 页面加载中 */
    loading: true,
    /** 保存中 */
    saving: false,
    /** 表单数据 */
    form: {
      name: "",
      englishName: "",
      birthday: "",
    },
    /** 是否显示日期选择弹窗 */
    showDatePicker: false,
    /** 日期选择器当前值的时间戳 */
    currentDate: new Date("2020-05-20").getTime(),
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "";
    this.setData({ deviceId });
    this.fetchOwnerInfo(deviceId);
  },
  /**
   * 获取主人信息
   */
  fetchOwnerInfo(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c;
      this.setData({ loading: true });
      try {
        const res = yield (0, api_1.getOwnerInfo)(deviceId);
        const info = res.data;
        const name =
          (_a = info === null || info === void 0 ? void 0 : info.name) !==
            null && _a !== void 0
            ? _a
            : "";
        const englishName =
          (_b =
            info === null || info === void 0 ? void 0 : info.englishName) !==
            null && _b !== void 0
            ? _b
            : "";
        const birthday =
          (_c = info === null || info === void 0 ? void 0 : info.birthday) !==
            null && _c !== void 0
            ? _c
            : "";
        this.setData({
          "form.name": name,
          "form.englishName": englishName,
          "form.birthday": birthday,
          currentDate: birthday
            ? new Date(birthday).getTime()
            : new Date("2020-05-20").getTime(),
        });
      } catch (error) {
        wx.showToast({ title: "加载失败", icon: "none" });
      } finally {
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 名字输入变化
   */
  onNameChange(event) {
    this.setData({ "form.name": event.detail });
  },
  /**
   * 英文名输入变化
   */
  onEnglishNameChange(event) {
    this.setData({ "form.englishName": event.detail });
  },
  /**
   * 打开日期选择器
   */
  onOpenDatePicker() {
    const currentDate = this.data.form.birthday
      ? new Date(this.data.form.birthday).getTime()
      : new Date("2020-05-20").getTime();
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
    const date = (0, date_1.formatDate)(timestamp, "YYYY-MM-DD");
    this.setData({ "form.birthday": date });
  },
  /**
   * 确认日期选择
   */
  onDateConfirm(event) {
    const timestamp = event.detail;
    const date = (0, date_1.formatDate)(timestamp, "YYYY-MM-DD");
    this.setData({
      "form.birthday": date,
      showDatePicker: false,
    });
  },
  /**
   * 保存主人信息
   */
  onSave() {
    return __awaiter(this, void 0, void 0, function* () {
      const name = this.data.form.name || "";
      if (!name.trim()) {
        wx.showToast({ title: "请输入名字", icon: "none" });
        return;
      }
      this.setData({ saving: true });
      try {
        const { name, englishName, birthday } = this.data.form;
        yield (0, api_1.updateOwnerInfo)(this.data.deviceId, {
          name: name || undefined,
          englishName: englishName || undefined,
          birthday: birthday || undefined,
        });
        this.setData({ saving: false });
        wx.showToast({ title: "保存成功", icon: "success" });
        // 保存成功后清除设备列表缓存，确保返回列表页时重新加载
        this.clearDeviceListCache();
        setTimeout(() => {
          wx.navigateBack();
        }, 800);
      } catch (error) {
        this.setData({ saving: false });
        wx.showToast({ title: "保存失败", icon: "none" });
      }
    });
  },
  /**
   * 清除设备列表缓存
   */
  clearDeviceListCache() {
    try {
      wx.removeStorageSync(DEVICE_LIST_CACHE_KEY);
    } catch (error) {
      console.warn("[owner-info] 清除设备列表缓存失败", error);
    }
  },
});
