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
const chat_history_utils_1 = require("./chat-history.utils");
/**
 * 对话记录页
 * 进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 * 后端分页锚定最新（page=1 为最新一页），页内按时间正序返回
 * （最旧在前、最新在后），前端按返回顺序直接渲染，不要自行反转。
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
    return __awaiter(this, void 0, void 0, function* () {
      const deviceId =
        (options === null || options === void 0 ? void 0 : options.deviceId) ||
        (options === null || options === void 0 ? void 0 : options.id) ||
        "";
      const textbookId =
        (options === null || options === void 0
          ? void 0
          : options.textbookId) || "";
      const unitId =
        (options === null || options === void 0 ? void 0 : options.unitId) ||
        "";
      const conversationModeKey =
        (options === null || options === void 0
          ? void 0
          : options.conversationModeKey) || "";
      this.setData({ deviceId, textbookId, unitId, conversationModeKey });
      // 先完成语境解析（含配置兜底过滤）再首次查询,避免竞态发出未过滤请求
      yield this.loadContext(deviceId, textbookId, unitId, conversationModeKey);
      this.loadInitialRecords();
    });
  },
  /**
   * 加载页面上下文：优先使用 URL 传入的参数，否则回退到设备当前配置
   */
  loadContext(deviceId, textbookId, unitId, conversationModeKey) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d;
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
        // URL 无参：按设备当前配置推导过滤,保持页面语境与设备学习状态一致;
        // 配置拉取失败才退回「全部对话记录」
        try {
          const res = yield (0, api_1.getDeviceCurrentConfig)(deviceId);
          const config = res.data;
          const filters = (0, chat_history_utils_1.resolveHistoryFilters)(
            {},
            config,
          );
          this.setData({
            textbookId:
              (_b = filters.textbookId) !== null && _b !== void 0 ? _b : "",
            unitId: (_c = filters.unitId) !== null && _c !== void 0 ? _c : "",
            conversationModeKey:
              (_d = filters.conversationModeKey) !== null && _d !== void 0
                ? _d
                : "",
          });
          this.applyContext(config);
        } catch (error) {
          console.warn("[chat-history] 加载设备配置失败", error);
          wx.setNavigationBarTitle({ title: "全部对话记录" });
          this.setData({ contextHint: "查看该设备全部历史对话" });
        }
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
        const records = (0, chat_history_utils_1.buildDisplayRecords)(items);
        this.setData({
          records,
          // total 按对话行计,records 是拆条后的消息数,须用行口径判断
          hasMore: (0, chat_history_utils_1.computeHasMore)(
            1,
            this.data.pageSize,
            total,
          ),
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
        // 最短展示时长：保证顶部「加载更早消息...」spinner 可被用户看见
        const res = yield (0, chat_history_utils_1.withMinDelay)(
          (0, api_1.getChatRecords)({
            page: this.data.page,
            pageSize: this.data.pageSize,
            deviceId: this.data.deviceId,
            textbookId: this.data.textbookId,
            unitId: this.data.unitId,
            conversationModeKey: this.data.conversationModeKey,
          }),
        );
        const items = res.data.items || [];
        const total = res.data.total || 0;
        const olderRecords = (0, chat_history_utils_1.buildDisplayRecords)(
          items,
        );
        const merged = olderRecords.concat(this.data.records);
        this.setData({
          records: merged,
          // 同上:行口径,this.data.page 是刚取完的页号
          hasMore: (0, chat_history_utils_1.computeHasMore)(
            this.data.page,
            this.data.pageSize,
            total,
          ),
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
});
