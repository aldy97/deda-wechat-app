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
const switch_mode_utils_1 = require("./switch-mode.utils");
/** 缓存键 */
const CACHE_KEY = "switch_mode_categories_cache";
/** 缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;
/**
 * 切换模式页
 * 从服务端动态获取学习/对话模式分类，支持缓存与加载态。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    saving: false,
    currentMode: "",
    modes: [],
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "";
    this.setData({ deviceId });
    this.loadCategories();
    this.loadCurrentConfig();
  },
  /**
   * 加载模式分类：优先缓存，后台刷新
   */
  loadCategories() {
    return __awaiter(this, void 0, void 0, function* () {
      const cache = this.getCache();
      if (cache) {
        this.setData({ modes: cache.data, loading: false });
      }
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getConversationModeCategories)();
        const modes = res.data.map(this.mapCategoryToDisplay);
        this.setData({ modes, loading: false });
        this.saveCache(modes);
      } catch (error) {
        console.error("[switch-mode] load categories failed:", error);
        if (!cache) {
          wx.showToast({ title: "加载失败", icon: "none" });
          this.setData({ loading: false });
        }
      }
    });
  },
  /**
   * 加载当前生效配置，用于高亮已选分类
   */
  loadCurrentConfig() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.deviceId) return;
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getDeviceCurrentConfig)(this.data.deviceId);
        const config = res.data;
        this.setData({ currentMode: config.mode });
        this.saveDeviceConfigCache(config);
      } catch (error) {
        console.error("[switch-mode] load current config failed:", error);
      }
    });
  },
  /**
   * 将服务端分类映射为页面展示项
   */
  mapCategoryToDisplay(category) {
    return {
      key: category.key,
      title: category.name,
      description: category.description || "",
    };
  },
  /**
   * 读取本地缓存
   */
  getCache() {
    try {
      const cache = wx.getStorageSync(CACHE_KEY);
      if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
        return cache;
      }
      return null;
    } catch (error) {
      return null;
    }
  },
  /**
   * 写入本地缓存
   */
  saveCache(modes) {
    try {
      wx.setStorageSync(CACHE_KEY, { data: modes, timestamp: Date.now() });
    } catch (error) {
      console.warn("[switch-mode] cache save failed:", error);
    }
  },
  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn("[switch-mode] device config cache save failed:", error);
    }
  },
  /**
   * 选择模式：点分类只做导航，不在此页保存配置。
   * 完整载荷由子选择页提交（后端对 mode-only 载荷返回 400）。
   * 用户未完成子选择就返回时,设备配置保持不变,这是预期行为。
   */
  onSelectMode(event) {
    const { key } = event.currentTarget.dataset;
    const { deviceId } = this.data;
    if (!deviceId) {
      wx.showToast({ title: "设备 ID 缺失", icon: "none" });
      return;
    }
    const url = (0, switch_mode_utils_1.resolveModeRoute)(key, deviceId);
    if (!url) {
      wx.showToast({ title: "暂不支持该模式", icon: "none" });
      return;
    }
    wx.navigateTo({ url });
  },
});
