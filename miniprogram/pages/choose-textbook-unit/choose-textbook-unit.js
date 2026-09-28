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
 * 选择教材单元页
 * 进入页面后立即展示加载状态，异步获取单元列表。
 */
Page({
  data: {
    deviceId: "",
    textbookId: "",
    loading: true,
    saving: false,
    currentUnitId: "",
    units: [],
  },
  onLoad(options) {
    const deviceId =
      (options === null || options === void 0 ? void 0 : options.deviceId) ||
      "";
    const textbookId =
      (options === null || options === void 0 ? void 0 : options.textbookId) ||
      "";
    this.setData({ deviceId, textbookId });
    this.loadUnits();
    this.loadCurrentConfig();
  },
  /**
   * 加载单元列表
   */
  loadUnits() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true });
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getTextbookUnits)(this.data.textbookId);
        const units = res.data.map(this.mapUnitToDisplay);
        this.setData({ units, loading: false });
      } catch (error) {
        console.error("[choose-textbook-unit] load units failed:", error);
        wx.showToast({ title: "加载失败", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },
  /**
   * 加载当前生效配置，用于高亮已选单元
   */
  loadCurrentConfig() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this.data.deviceId) return;
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.getDeviceCurrentConfig)(this.data.deviceId);
        const config = res.data;
        if (
          config.mode === "locked_unit" &&
          config.textbookId === this.data.textbookId &&
          config.unitId
        ) {
          this.setData({ currentUnitId: config.unitId });
        }
      } catch (error) {
        console.error(
          "[choose-textbook-unit] load current config failed:",
          error,
        );
      }
    });
  },
  /**
   * 将服务端单元映射为页面展示项
   */
  mapUnitToDisplay(unit) {
    return {
      key: unit.unitId,
      title: unit.name,
      description: unit.description || "",
      cefrLevel: unit.cefrLevel,
      difficulty: unit.difficulty,
    };
  },
  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn(
        "[choose-textbook-unit] device config cache save failed:",
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
   * 选择单元：保存 locked_unit + textbookId + unitId
   */
  onSelectUnit(event) {
    return __awaiter(this, void 0, void 0, function* () {
      const { key } = event.currentTarget.dataset;
      const { deviceId, textbookId, units } = this.data;
      if (!deviceId || !textbookId) {
        wx.showToast({ title: "参数缺失", icon: "none" });
        return;
      }
      this.setData({ saving: true });
      try {
        yield (0, api_1.ensureAuthToken)();
        const res = yield (0, api_1.applyDeviceConfig)(deviceId, {
          mode: "locked_unit",
          textbookId,
          unitId: key,
        });
        const config = res.data;
        // 仅在 API 成功后更新选中状态，避免默认显示成功
        this.setData({ currentUnitId: key });
        // 把选中单元的描述一并缓存，供设备列表卡片展示
        const selectedUnit = units.find((u) => u.key === key);
        const configWithDesc = Object.assign(Object.assign({}, config), {
          unitDescription:
            (selectedUnit === null || selectedUnit === void 0
              ? void 0
              : selectedUnit.description) || null,
        });
        this.saveDeviceConfigCache(configWithDesc);
        this.updateDeviceListPage(configWithDesc);
        this.setData({ saving: false });
        wx.switchTab({ url: "/pages/device-list/device-list" });
      } catch (error) {
        console.error("[choose-textbook-unit] apply config failed:", error);
        this.setData({ saving: false });
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    });
  },
});
