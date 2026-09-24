import {
  getTextbookUnits,
  getDeviceCurrentConfig,
  applyDeviceConfig,
  TextbookUnit,
  DeviceConfig,
  ensureAuthToken,
} from '../../api/api';

interface UnitDisplayItem {
  key: string;
  title: string;
  description: string;
  cefrLevel?: string | null;
  difficulty?: number | null;
}

/**
 * 选择教材单元页
 * 进入页面后立即展示加载状态，异步获取单元列表。
 */
Page({
  data: {
    deviceId: '',
    textbookId: '',
    loading: true,
    saving: false,
    currentUnitId: '',
    units: [] as UnitDisplayItem[],
  },

  onLoad(options) {
    const deviceId = options?.deviceId || '';
    const textbookId = options?.textbookId || '';
    this.setData({ deviceId, textbookId });
    this.loadUnits();
    this.loadCurrentConfig();
  },

  /**
   * 加载单元列表
   */
  async loadUnits() {
    this.setData({ loading: true });

    try {
      await ensureAuthToken();
      const res = await getTextbookUnits(this.data.textbookId);
      const units = res.data.map(this.mapUnitToDisplay);
      this.setData({ units, loading: false });
    } catch (error) {
      console.error('[choose-textbook-unit] load units failed:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 加载当前生效配置，用于高亮已选单元
   */
  async loadCurrentConfig() {
    if (!this.data.deviceId) return;

    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(this.data.deviceId);
      const config = res.data;
      if (
        config.mode === 'locked_unit' &&
        config.textbookId === this.data.textbookId &&
        config.unitId
      ) {
        this.setData({ currentUnitId: config.unitId });
      }
    } catch (error) {
      console.error('[choose-textbook-unit] load current config failed:', error);
    }
  },

  /**
   * 将服务端单元映射为页面展示项
   */
  mapUnitToDisplay(unit: TextbookUnit): UnitDisplayItem {
    return {
      key: unit.unitId,
      title: unit.name,
      description: unit.description || '',
      cefrLevel: unit.cefrLevel,
      difficulty: unit.difficulty,
    };
  },

  /**
   * 保存设备配置到本地缓存
   */
  saveDeviceConfigCache(config: DeviceConfig) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn('[choose-textbook-unit] device config cache save failed:', error);
    }
  },

  /**
   * 更新设备列表页的配置显示，避免返回时闪动
   */
  updateDeviceListPage(config: DeviceConfig) {
    const pages = getCurrentPages();
    const deviceListPage = pages.find((p) => p.route === 'pages/device-list/device-list');
    if (deviceListPage && typeof (deviceListPage as any).updateDeviceConfig === 'function') {
      (deviceListPage as any).updateDeviceConfig(config);
    }
  },

  /**
   * 选择单元：保存 locked_unit + textbookId + unitId
   */
  async onSelectUnit(event: WechatMiniprogram.TouchEvent) {
    const { key } = event.currentTarget.dataset;
    const { deviceId, textbookId, units } = this.data;

    if (!deviceId || !textbookId) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }

    this.setData({ saving: true, currentUnitId: key });

    try {
      await ensureAuthToken();
      const res = await applyDeviceConfig(deviceId, {
        mode: 'locked_unit',
        textbookId,
        unitId: key,
      });
      const config = res.data;

      // 把选中单元的描述一并缓存，供设备列表卡片展示
      const selectedUnit = units.find((u) => u.key === key);
      const configWithDesc: DeviceConfig = {
        ...config,
        unitDescription: selectedUnit?.description || null,
      };
      this.saveDeviceConfigCache(configWithDesc);
      this.updateDeviceListPage(configWithDesc);

      wx.switchTab({ url: '/pages/device-list/device-list' });
    } catch (error) {
      console.error('[choose-textbook-unit] apply config failed:', error);
      this.setData({ saving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
});
