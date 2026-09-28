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
/** 缓存键 */
const CACHE_KEY = "free_chat_modes_cache";
/** 缓存有效期：10 分钟 */
const CACHE_TTL = 10 * 60 * 1000;
/**
 * 选择自由对话模式页
 * 从服务端动态获取自由对话模式下的子模式，支持缓存与加载态。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    saving: false,
    currentSubMode: "",
    modes: [],
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "";
    this.setData({ deviceId });
    this.loadFreeChatModes();
    this.loadCurrentConfig();
  },
  /**
   * 加载自由对话模式下的子模式：优先缓存，后台刷新
   */
  loadFreeChatModes() {
    return __awaiter(this, void 0, void 0, function* () {
      const cache = this.getCache();
      if (cache) {
        this.setData({ modes: cache.data, loading: false });
      }
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getConversationModes)("free_chat");
        const modes = res.data.map(this.mapModeToDisplay);
        this.setData({ modes, loading: false });
        this.saveCache(modes);
      } catch (error) {
        console.error("[choose-free-chat-mode] load modes failed:", error);
        if (!cache) {
          wx.showToast({ title: "加载失败", icon: "none" });
          this.setData({ loading: false });
        }
      }
    });
  },
  /**
   * 加载当前生效配置，用于高亮已选子模式
   */
  loadCurrentConfig() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.deviceId) return;
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getDeviceCurrentConfig)(this.data.deviceId);
        const config = res.data;
        if (config.mode === "free_chat" && config.conversationModeKey) {
          this.setData({ currentSubMode: config.conversationModeKey });
        }
      } catch (error) {
        console.error(
          "[choose-free-chat-mode] load current config failed:",
          error,
        );
      }
    });
  },
  /**
   * 将服务端模式映射为页面展示项
   */
  mapModeToDisplay(mode) {
    return {
      key: mode.key,
      title: mode.name,
      description: mode.description || "",
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
      console.warn("[choose-free-chat-mode] cache save failed:", error);
    }
  },
  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn(
        "[choose-free-chat-mode] device config cache save failed:",
        error,
      );
    }
  },
  /**
   * 更新设备列表页的配置显示，避免返回时闪动
   */
  updateDeviceListPage(config) {
    const pages = getCurrentPages();
    const deviceListPage = pages.find(
      (p) => p.route === "pages/device-list/device-list",
    );
    if (
      deviceListPage &&
      typeof deviceListPage.updateDeviceConfig === "function"
    ) {
      deviceListPage.updateDeviceConfig(config);
    }
  },
  /**
   * 选择具体自由对话模式
   */
  onSelectMode(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const { key } = event.currentTarget.dataset;
      const { deviceId, modes } = this.data;
      if (!deviceId) {
        wx.showToast({ title: "设备 ID 缺失", icon: "none" });
        return;
      }
      this.setData({ saving: true });
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.switchDeviceMode)(deviceId, {
          mode: "free_chat",
          conversationModeKey: key,
        });
        const config = res.data;
        // 仅在 API 成功后更新选中状态，避免默认显示成功
        this.setData({ currentSubMode: key });
        // 把选中子模式的名称和描述一并缓存，供设备列表卡片展示
        const selectedMode = modes.find((m) => m.key === key);
        const configWithDesc = Object.assign(Object.assign({}, config), {
          conversationModeName:
            (selectedMode === null || selectedMode === void 0
              ? void 0
              : selectedMode.title) || null,
          conversationModeDescription:
            (selectedMode === null || selectedMode === void 0
              ? void 0
              : selectedMode.description) || null,
        });
        this.saveDeviceConfigCache(configWithDesc);
        this.updateDeviceListPage(configWithDesc);
        this.setData({ saving: false });
        wx.switchTab({ url: "/pages/device-list/device-list" });
      } catch (error) {
        console.error("[choose-free-chat-mode] switch mode failed:", error);
        this.setData({ saving: false });
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    });
  },
});
