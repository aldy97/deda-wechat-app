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
/** 本地联调样机 DEV001 */
const DEV001_DEVICE = {
  id: "dev-local-001",
  name: "DEV001（联调样机）",
  deviceId: "dev-local-001",
  deviceCode: "DEV001",
  networkType: "4G",
};
/** 模式展示名映射 */
const MODE_DISPLAY_MAP = {
  free_chat: "自由对话",
  textbook_learning: "教材学习",
  locked_unit: "教材单元",
  free_textbook: "自由教材",
};
/**
 * 设备列表页
 * 从后端拉取当前登录用户的真实绑定设备；若为空则自动绑定本地联调样机 DEV001。
 */
Page({
  data: {
    loading: true,
    devices: [],
  },
  onLoad() {
    this.loadDeviceList();
  },
  onShow() {
    this.loadDeviceList();
  },
  /**
   * 加载设备列表：优先真实绑定，空则自动绑定 DEV001
   */
  loadDeviceList() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true });
      try {
        yield (0, api_1.ensureAuthToken)();
        let devices = yield this.fetchBoundDevices();
        if (devices.length === 0) {
          console.log("[device-list] no bound devices, auto-bind DEV001");
          yield (0, api_1.bindDevice)({ deviceId: DEV001_DEVICE.deviceId });
          devices = yield this.fetchBoundDevices();
        }
        const displayItems = yield this.enrichDevices(devices);
        this.setData({ devices: displayItems, loading: false });
      } catch (error) {
        console.error("[device-list] load device list failed:", error);
        wx.showToast({
          title: error instanceof Error ? error.message : "加载设备失败",
          icon: "none",
        });
        this.setData({ devices: [], loading: false });
      }
    });
  },
  /**
   * 从后端获取当前用户已绑定设备
   */
  fetchBoundDevices() {
    return __awaiter(this, void 0, void 0, function* () {
      const res = yield (0, api_1.getDeviceList)();
      return res.data || [];
    });
  },
  /**
   * 为设备列表补充状态与当前配置
   */
  enrichDevices(devices) {
    return __awaiter(this, void 0, void 0, function* () {
      return Promise.all(
        devices.map((device) =>
          __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const item = Object.assign(Object.assign({}, device), {
              statusLoading: true,
            });
            const cachedConfig = this.getDeviceConfigCache(item.id);
            if (cachedConfig) {
              this.applyConfigToDevice(item, cachedConfig);
            }
            try {
              const [status, serverConfig] = yield Promise.all([
                this.fetchDeviceStatus(item.id),
                this.fetchDeviceCurrentConfig(item.id),
              ]);
              item.status = status.status;
              item.battery = status.battery;
              item.isCharging = status.isCharging;
              item.lastActiveAt = status.lastActiveAt;
              if (serverConfig) {
                // 服务端配置不含 name/description，需与本地缓存合并保留
                const mergedConfig = Object.assign(
                  Object.assign({}, serverConfig),
                  {
                    conversationModeName:
                      serverConfig.conversationModeName ||
                      (cachedConfig === null || cachedConfig === void 0
                        ? void 0
                        : cachedConfig.conversationModeName),
                    conversationModeDescription:
                      serverConfig.conversationModeDescription ||
                      (cachedConfig === null || cachedConfig === void 0
                        ? void 0
                        : cachedConfig.conversationModeDescription),
                    unitDescription:
                      serverConfig.unitDescription ||
                      (cachedConfig === null || cachedConfig === void 0
                        ? void 0
                        : cachedConfig.unitDescription),
                  },
                );
                this.applyConfigToDevice(item, mergedConfig);
                this.saveDeviceConfigCache(mergedConfig);
              }
            } catch (error) {
              item.status = item.status || "offline";
              item.battery =
                (_a = item.battery) !== null && _a !== void 0 ? _a : 0;
              item.isCharging =
                (_b = item.isCharging) !== null && _b !== void 0 ? _b : false;
            } finally {
              item.statusLoading = false;
            }
            return item;
          }),
        ),
      );
    });
  },
  /**
   * 获取单个设备状态/电量
   */
  fetchDeviceStatus(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const res = yield (0, api_1.getDeviceStatus)(deviceId);
        return res.data;
      } catch (error) {
        return {
          deviceId,
          status: "offline",
          battery: 0,
          isCharging: false,
          lastActiveAt: "",
        };
      }
    });
  },
  /**
   * 获取设备当前生效配置
   */
  fetchDeviceCurrentConfig(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getDeviceCurrentConfig)(deviceId);
        return res.data;
      } catch (error) {
        console.error("[device-list] fetch current config failed:", error);
        return null;
      }
    });
  },
  /**
   * 将配置应用到设备展示项
   */
  applyConfigToDevice(device, config) {
    const modeName = MODE_DISPLAY_MAP[config.mode] || config.mode;
    if (config.mode === "free_chat") {
      // 自由对话：标题显示子模式中文名，描述显示子模式描述
      device.cardTitle =
        config.conversationModeName || config.conversationModeKey || modeName;
      device.cardSubtitle = "";
      device.cardDesc =
        config.conversationModeDescription ||
        "自由对话模式，随时陪伴孩子聊天互动。";
    } else if (config.textbookId) {
      // 教材模式：标题显示教材名，副标题显示单元名，描述显示单元描述
      device.cardTitle = config.textbookName || config.textbookId;
      device.cardSubtitle = config.unitName || config.unitId || "";
      device.cardDesc =
        config.unitDescription ||
        config.textbookName ||
        config.textbookId ||
        "教材学习模式，系统化提升英语能力。";
    } else {
      // 兜底
      device.cardTitle = modeName;
      device.cardSubtitle = "";
      device.cardDesc = "DEDA AI 玩偶，随时在线陪伴孩子学习与成长。";
    }
  },
  /**
   * 读取本地配置缓存
   */
  getDeviceConfigCache(deviceId) {
    try {
      return wx.getStorageSync(`device_config_${deviceId}`) || null;
    } catch (error) {
      return null;
    }
  },
  /**
   * 写入本地配置缓存
   */
  saveDeviceConfigCache(config) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn("[device-list] save config cache failed:", error);
    }
  },
  /**
   * 供其他页面调用，直接更新设备列表中的配置显示
   */
  updateDeviceConfig(config) {
    const { devices } = this.data;
    const index = devices.findIndex((d) => d.id === config.deviceId);
    if (index === -1) return;
    const device = Object.assign({}, devices[index]);
    this.applyConfigToDevice(device, config);
    this.setData({ [`devices[${index}]`]: device });
    this.saveDeviceConfigCache(config);
  },
  /**
   * 查看对话：跳转对话记录页
   */
  onViewChat(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?id=${id}`,
    });
  },
  /**
   * 智能分析：跳转单设备智能分析页
   */
  onViewAnalysis(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-analysis/device-analysis?id=${id}`,
    });
  },
  /**
   * 孩子姓名区域：未设置孩子档案时跳转设备设置页，已设置则不响应
   */
  onChildNameTap(event) {
    const { id } = event.currentTarget.dataset;
    const device = this.data.devices.find((d) => d.id === id);
    if (device && !device.childProfile) {
      wx.navigateTo({
        url: `/pages/device-setting/device-setting?id=${id}`,
      });
    }
  },
  /**
   * 设置入口：跳转设备设置页
   */
  onSettingsTap(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-setting/device-setting?id=${id}`,
    });
  },
  /**
   * 切换模式：跳转切换模式页
   */
  onSwitchMode(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/switch-mode/switch-mode?id=${id}`,
    });
  },
  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    return __awaiter(this, void 0, void 0, function* () {
      yield this.loadDeviceList();
      wx.stopPullDownRefresh();
    });
  },
});
