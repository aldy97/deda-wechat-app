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
/**
 * 对话记录页
 * 进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 * 后端按 spokeAt 倒序返回（最新在前），前端渲染时按数组顺序展示，
 * 通过 CSS 控制消息从底部向上排列。
 */
Page({
  data: {
    deviceId: "",
    textbookId: "",
    unitId: "",
    conversationModeKey: "",
    loading: false,
    records: [],
    hasMore: true,
    page: 1,
    pageSize: 20,
    initialLoaded: false,
    scrollIntoView: "",
    contextHint: "",
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.deviceId) ||
      (options === null || options === void 0 ? void 0 : options.id) ||
      "";
    const textbookId =
      (options === null || options === void 0 ? void 0 : options.textbookId) ||
      "";
    const unitId =
      (options === null || options === void 0 ? void 0 : options.unitId) || "";
    const conversationModeKey =
      (options === null || options === void 0
        ? void 0
        : options.conversationModeKey) || "";
    this.setData({ deviceId, textbookId, unitId, conversationModeKey });
    this.loadContext(deviceId, textbookId, unitId, conversationModeKey);
    this.loadInitialRecords();
  },
  /**
   * 加载页面上下文：优先使用 URL 传入的参数，否则回退到设备当前配置
   */
  loadContext(deviceId, textbookId, unitId, conversationModeKey) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      if (!deviceId) return;
      if (textbookId && unitId) {
        try {
          const [textbookRes, unitsRes] = yield Promise.all([
            (0, api_1.getTextbookDetail)(textbookId),
            (0, api_1.getTextbookUnits)(textbookId),
          ]);
          const textbook = textbookRes.data;
          const unit =
            (_a = unitsRes.data) === null || _a === void 0
              ? void 0
              : _a.find((u) => u.unitId === unitId);
          const title = unit
            ? `${(textbook === null || textbook === void 0 ? void 0 : textbook.name) || textbookId} · ${unit.name}`
            : "对话记录";
          wx.setNavigationBarTitle({ title });
          this.setData({
            contextHint:
              (unit === null || unit === void 0 ? void 0 : unit.description) ||
              (textbook === null || textbook === void 0
                ? void 0
                : textbook.description) ||
              "",
          });
          return;
        } catch (error) {
          console.warn("[chat-history] 加载教材单元信息失败", error);
        }
      }
      if (textbookId) {
        try {
          const res = yield (0, api_1.getTextbookDetail)(textbookId);
          const textbook = res.data;
          wx.setNavigationBarTitle({
            title: `${(textbook === null || textbook === void 0 ? void 0 : textbook.name) || textbookId} · 全部单元`,
          });
          this.setData({
            contextHint:
              (textbook === null || textbook === void 0
                ? void 0
                : textbook.description) || "",
          });
          return;
        } catch (error) {
          console.warn("[chat-history] 加载教材信息失败", error);
        }
      }
      if (conversationModeKey) {
        wx.setNavigationBarTitle({ title: conversationModeKey });
        this.setData({ contextHint: "" });
        return;
      }
      if (!textbookId && !unitId && !conversationModeKey) {
        wx.setNavigationBarTitle({ title: "全部对话记录" });
        this.setData({ contextHint: "查看该设备全部历史对话" });
        return;
      }
      try {
        const res = yield (0, api_1.getDeviceCurrentConfig)(deviceId);
        const config = res.data;
        this.applyContext(config);
      } catch (error) {
        console.warn("[chat-history] 加载设备配置失败", error);
      }
    });
  },
  applyContext(config) {
    let title = "";
    let hint = "";
    if (config.mode === "free_chat" && config.conversationModeName) {
      title = config.conversationModeName;
      hint = config.conversationModeDescription || "";
    } else if (
      (config.mode === "locked_unit" || config.mode === "textbook_learning") &&
      config.textbookName
    ) {
      title = config.unitName
        ? `${config.textbookName} · ${config.unitName}`
        : config.textbookName;
      hint = config.unitDescription || config.textbookName || "";
    } else {
      title = config.textbookName || config.conversationModeName || "对话记录";
      hint = config.unitDescription || config.conversationModeDescription || "";
    }
    wx.setNavigationBarTitle({ title });
    this.setData({ contextHint: hint });
  },
  /**
   * 初始加载：拉取第一页（最新 N 条）并滚动到底部
   */
  loadInitialRecords() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true, page: 1 });
      try {
        const res = yield (0, api_1.getChatRecords)({
          page: 1,
          pageSize: this.data.pageSize,
          deviceId: this.data.deviceId,
          textbookId: this.data.textbookId,
          unitId: this.data.unitId,
          conversationModeKey: this.data.conversationModeKey,
        });
        const items = res.data.items || [];
        const total = res.data.total || 0;
        const records = this.buildDisplayRecords(items);
        this.setData({
          records,
          hasMore: records.length < total,
          page: 2,
          initialLoaded: true,
          scrollIntoView: "msg-last",
        });
      } catch (error) {
        wx.showToast({ title: "记录加载失败", icon: "none" });
      } finally {
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 向上滚动到顶部时加载更早消息（下一页）
   */
  onScrollToUpper() {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      if (!this.data.hasMore || this.data.loading) return;
      const anchorMessageId =
        ((_a = this.data.records[0]) === null || _a === void 0
          ? void 0
          : _a.id) || "";
      this.setData({ loading: true, scrollIntoView: "" });
      try {
        const res = yield (0, api_1.getChatRecords)({
          page: this.data.page,
          pageSize: this.data.pageSize,
          deviceId: this.data.deviceId,
          textbookId: this.data.textbookId,
          unitId: this.data.unitId,
          conversationModeKey: this.data.conversationModeKey,
        });
        const items = res.data.items || [];
        const total = res.data.total || 0;
        const olderRecords = this.buildDisplayRecords(items);
        const merged = olderRecords.concat(this.data.records);
        this.setData({
          records: merged,
          hasMore: merged.length < total,
          page: this.data.page + 1,
          scrollIntoView: anchorMessageId ? `msg-${anchorMessageId}` : "",
        });
      } catch (error) {
        wx.showToast({ title: "加载失败", icon: "none" });
      } finally {
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 为记录列表计算显示时间
   * 后端返回倒序（最新在前），这里从旧到新遍历以判断相邻消息间隔。
   */
  buildDisplayRecords(items) {
    const result = [];
    let previousIso;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const showTime = (0, date_1.shouldShowTime)(item.createdAt, previousIso);
      result.unshift(
        Object.assign(Object.assign({}, item), {
          displayTime: showTime
            ? (0, date_1.formatChatTime)(item.createdAt)
            : undefined,
        }),
      );
      if (showTime) {
        previousIso = item.createdAt;
      }
    }
    return result;
  },
});
