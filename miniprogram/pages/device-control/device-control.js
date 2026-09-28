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
/** 模式展示名映射 */
const MODE_DISPLAY_MAP = {
  free_chat: "自由对话",
  textbook_learning: "教材学习",
  locked_unit: "教材单元",
  free_textbook: "自由教材",
};
/**
 * 设备控制面板页
 * 展示设备开关、音量、模式等控制项。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    device: {},
    currentConfig: null,
    currentModeDisplay: "",
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.id) || "D001";
    this.setData({ deviceId });
    this.fetchDeviceData(deviceId);
    this.fetchCurrentConfig(deviceId);
  },
  /**
   * 拉取设备控制数据
   */
  fetchDeviceData(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true });
      try {
        const res = yield (0, api_1.getDeviceControl)(deviceId);
        this.setData({ device: res.data });
      } catch (error) {
        wx.showToast({ title: "加载失败", icon: "none" });
      } finally {
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 拉取当前对话模式配置
   */
  fetchCurrentConfig(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getDeviceCurrentConfig)(deviceId);
        const config = res.data;
        this.setData({
          currentConfig: config,
          currentModeDisplay: this.formatModeDisplay(config),
        });
        wx.setStorageSync(`device_config_${deviceId}`, config);
      } catch (error) {
        console.error("[device-control] fetch current config failed:", error);
      }
    });
  },
  /**
   * 格式化模式展示文本
   */
  formatModeDisplay(config) {
    const modeName = MODE_DISPLAY_MAP[config.mode] || config.mode;
    if (config.mode === "free_chat" && config.conversationModeKey) {
      return `${modeName} / ${config.conversationModeKey}`;
    }
    if (
      (config.mode === "textbook_learning" || config.mode === "locked_unit") &&
      config.textbookId
    ) {
      const textbook = config.textbookName || config.textbookId;
      const unit = config.unitName || config.unitId;
      return unit
        ? `${modeName} / ${textbook} / ${unit}`
        : `${modeName} / ${textbook}`;
    }
    if (config.mode === "free_textbook" && config.textbookId) {
      const textbook = config.textbookName || config.textbookId;
      return `${modeName} / ${textbook}`;
    }
    return modeName;
  },
  /**
   * 电源开关切换
   */
  onPowerChange(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const power = event.detail;
      this.setData({ "device.power": power });
      yield this.updateDevice({ power });
    });
  },
  /**
   * 音量滑块变化
   */
  onVolumeChange(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const volume = event.detail;
      this.setData({ "device.volume": volume });
    });
  },
  /**
   * 音量滑块拖动结束，提交更新
   */
  onVolumeDragEnd(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const volume = event.detail;
      yield this.updateDevice({ volume });
    });
  },
  /**
   * 模式切换
   */
  onModeChange(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const mode = event.detail;
      this.setData({ "device.mode": mode });
      yield this.updateDevice({ mode });
    });
  },
  /**
   * 更新设备状态
   */
  updateDevice(partial) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const res = yield (0, api_1.updateDeviceControl)(
          this.data.deviceId,
          partial,
        );
        this.setData({ device: res.data });
      } catch (error) {
        wx.showToast({ title: "更新失败", icon: "none" });
      }
    });
  },
});
