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
/**
 * 教材学习页
 * 从服务端动态获取教材列表，点击后跳转单元选择页。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    textbooks: [],
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "";
    this.setData({ deviceId });
    this.loadTextbooks();
  },
  /**
   * 加载教材列表
   */
  loadTextbooks() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true });
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getTextbooks)();
        const textbooks = res.data.map(this.mapTextbookToDisplay);
        this.setData({ textbooks, loading: false });
      } catch (error) {
        console.error("[textbook-learning] load textbooks failed:", error);
        wx.showToast({ title: "加载失败", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 将服务端教材映射为页面展示项
   */
  mapTextbookToDisplay(textbook) {
    return {
      key: textbook.textbookId,
      title: textbook.name,
      description: textbook.description || "",
      cefrLevel: textbook.cefrLevel,
    };
  },
  /**
   * 选择教材，跳转单元选择页
   */
  onSelectTextbook(event) {
    const { key } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/choose-textbook-unit/choose-textbook-unit?deviceId=${this.data.deviceId}&textbookId=${key}`,
    });
  },
});
