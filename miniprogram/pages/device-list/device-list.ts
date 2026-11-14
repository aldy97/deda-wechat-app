import {
  getDeviceList,
  getDeviceStatus,
  getDeviceCurrentConfig,
  Device,
  DeviceStatus,
  DeviceConfig,
  ensureAuthToken,
} from "../../api/api";
import { MODE_LABELS } from "../learning-data/learning-data";

/** 模式展示名映射 */
const MODE_DISPLAY_MAP: Record<string, string> = {
  free_chat: "自由对话",
};

/** 设备列表缓存键（与 device-setting / owner-info / device-provision 的失效点保持一致） */
const DEVICE_LIST_CACHE_KEY = "device_list_cache";

/** 设备展示项 = 基础信息 + 状态信息 + 卡片内容 */
interface DeviceDisplayItem extends Device {
  status?: DeviceStatus["status"];
  /** 电量 0-100；设备未上报为 null，勿按 0% 展示 */
  battery?: number | null;
  /** 是否充电中，null = 未知（厂商契约 boolean | null，当前固件恒发 null） */
  isCharging?: boolean | null;
  lastActiveAt?: string | null;
  /** 最近活跃的展示文案；从未上报为「暂未连接」 */
  lastActiveText?: string;
  /** status 接口返回 404（设备不存在/已被 wipe） */
  statusNotFound?: boolean;
  statusLoading?: boolean;
  cardTitle?: string;
  cardSubtitle?: string;
  cardDesc?: string;
}

/**
 * 设备列表页
 * 从后端拉取当前登录用户的真实绑定设备；空列表展示空态并引导去配网绑定。
 */
Page({
  data: {
    loading: true,
    devices: [] as DeviceDisplayItem[],
  },

  /** 首次加载是否已发起（onShow 每次触发，仅在首次之后才重复拉取） */
  hasInitialLoaded: false,

  onLoad() {},

  onReady() {
    this.loadDeviceList();
  },

  onShow() {
    // 真机首个 onShow 早于 onReady，跳过避免双请求；之后每次回前台静默刷新
    if (this.hasInitialLoaded) {
      this.loadDeviceList({ silent: true });
    }
  },

  /**
   * 加载设备列表（SWR）：
   * - 无缓存首次进入：整页 loading
   * - 有缓存：首帧直出缓存快照，后台刷新后原地更新
   * - silent（回前台/下拉刷新）：不翻 loading、不清空列表，失败保留旧数据
   */
  async loadDeviceList(options?: { silent?: boolean }) {
    const silent = !!options?.silent;
    this.hasInitialLoaded = true;

    const hasRendered = this.data.devices.length > 0;
    const restored = hasRendered ? false : this.restoreDeviceListCache();
    if (!hasRendered && !restored) {
      this.setData({ loading: true });
    }

    try {
      await ensureAuthToken();
      const devices = await this.fetchBoundDevices();

      const displayItems = await this.enrichDevices(
        devices,
        silent ? this.data.devices : undefined,
      );
      this.setData({ devices: displayItems, loading: false });
      this.writeDeviceListCache(displayItems);
    } catch (error) {
      if (silent || hasRendered || restored) {
        // 静默刷新失败：保留旧数据，不打扰用户
        console.warn("[device-list] silent refresh failed:", error);
        this.setData({ loading: false });
        return;
      }
      console.error("[device-list] load device list failed:", error);
      wx.showToast({
        title: error instanceof Error ? error.message : "加载设备失败",
        icon: "none",
      });
      this.setData({ devices: [], loading: false });
    }
  },

  /**
   * 读取设备列表缓存用于首帧直出；返回是否有可用缓存
   */
  restoreDeviceListCache(): boolean {
    try {
      const cached = wx.getStorageSync(DEVICE_LIST_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        this.setData({ devices: cached, loading: false });
        return true;
      }
    } catch (error) {
      console.warn("[device-list] 读取设备列表缓存失败", error);
    }
    return false;
  },

  /**
   * 写入设备列表缓存（剔除 statusLoading 等瞬态字段）
   */
  writeDeviceListCache(items: DeviceDisplayItem[]) {
    try {
      wx.setStorageSync(
        DEVICE_LIST_CACHE_KEY,
        items.map((item) => {
          const snapshot = { ...item };
          delete snapshot.statusLoading;
          return snapshot;
        }),
      );
    } catch (error) {
      console.warn("[device-list] 写入设备列表缓存失败", error);
    }
  },

  /**
   * 从后端获取当前用户已绑定设备
   */
  async fetchBoundDevices(): Promise<Device[]> {
    const res = await getDeviceList();
    return res.data || [];
  },

  /**
   * 为设备列表补充状态与当前配置。
   * 静默刷新时传入 previous：沿用旧状态/电量/卡片快照，避免「电量...」闪烁。
   */
  async enrichDevices(
    devices: Device[],
    previous?: DeviceDisplayItem[],
  ): Promise<DeviceDisplayItem[]> {
    const previousById = new Map(
      (previous || []).map((item) => [item.id, item]),
    );
    return Promise.all(
      devices.map(async (device) => {
        const prev = previousById.get(device.id);
        const item: DeviceDisplayItem = {
          ...device,
          statusLoading: !prev,
          // 静默刷新：先展示旧快照，接口返回后再原地更新
          ...(prev
            ? {
                status: prev.status,
                battery: prev.battery,
                isCharging: prev.isCharging,
                lastActiveAt: prev.lastActiveAt,
                lastActiveText: prev.lastActiveText,
                statusNotFound: prev.statusNotFound,
                cardTitle: prev.cardTitle,
                cardSubtitle: prev.cardSubtitle,
                cardDesc: prev.cardDesc,
              }
            : {}),
        };

        const cachedConfig = this.getDeviceConfigCache(item.id);
        if (cachedConfig) {
          this.applyConfigToDevice(item, cachedConfig);
        }

        try {
          const [status, serverConfig] = await Promise.all([
            this.fetchDeviceStatus(item.id),
            this.fetchDeviceCurrentConfig(item.id),
          ]);
          if (status === null) {
            // status 404：设备不存在（可能已解绑/被 wipe），给兜底态，不弹窗不白屏
            item.statusNotFound = true;
            item.status = "offline";
            item.battery = null;
            item.isCharging = null;
            item.lastActiveAt = null;
          } else {
            item.status = status.status;
            item.battery = status.battery;
            item.isCharging = status.isCharging;
            item.lastActiveAt = status.lastActiveAt;
            item.lastActiveText = this.formatLastActive(status.lastActiveAt);
          }
          if (serverConfig) {
            // 服务端配置不再含独立 name/description 字段；直接使用
            this.applyConfigToDevice(item, serverConfig);
            this.saveDeviceConfigCache(serverConfig);
          }
        } catch (error) {
          item.status = item.status || "offline";
          // 状态拉取失败不等于设备没电：保持 null，由 WXML 展示「--」
          item.battery = item.battery ?? null;
          item.isCharging = item.isCharging ?? null;
        } finally {
          item.statusLoading = false;
        }

        return item;
      }),
    );
  },

  /**
   * 获取单个设备状态/电量。
   * 返回 null 表示设备不存在（404）；网络/服务异常返回离线兜底（各字段 null）。
   */
  async fetchDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    try {
      const res = await getDeviceStatus(deviceId);
      return res.data;
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 404) {
        console.warn(`[device-list] device not found: ${deviceId}`);
        return null;
      }
      console.error("[device-list] fetch device status failed:", error);
      return {
        deviceId,
        status: "offline",
        battery: null,
        volume: null,
        isCharging: null,
        lastActiveAt: null,
      };
    }
  },

  /**
   * 最近活跃时间 → 展示文案；null/非法时间一律「暂未连接」
   */
  formatLastActive(lastActiveAt: string | null): string {
    if (!lastActiveAt) return "暂未连接";
    const ts = Date.parse(lastActiveAt);
    if (Number.isNaN(ts)) return "暂未连接";
    const diffMs = Date.now() - ts;
    if (diffMs < 60 * 1000) return "最近活跃 刚刚";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `最近活跃 ${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `最近活跃 ${hours} 小时前`;
    return `最近活跃 ${Math.floor(hours / 24)} 天前`;
  },

  /**
   * 获取设备当前生效配置
   */
  async fetchDeviceCurrentConfig(
    deviceId: string,
  ): Promise<DeviceConfig | null> {
    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(deviceId);
      return res.data;
    } catch (error) {
      console.error("[device-list] fetch current config failed:", error);
      return null;
    }
  },

  /**
   * 将配置应用到设备展示项
   */
  applyConfigToDevice(device: DeviceDisplayItem, config: DeviceConfig) {
    const modeName = MODE_LABELS[config.mode] || MODE_DISPLAY_MAP[config.mode] || config.mode;

    device.cardTitle = modeName;
    device.cardSubtitle = "";
    device.cardDesc = "DEDA AI 玩偶，随时在线陪伴孩子学习与成长。";
  },

  /**
   * 读取本地配置缓存
   */
  getDeviceConfigCache(deviceId: string): DeviceConfig | null {
    try {
      return (
        (wx.getStorageSync(`device_config_${deviceId}`) as
          DeviceConfig | undefined) || null
      );
    } catch (error) {
      return null;
    }
  },

  /**
   * 写入本地配置缓存
   */
  saveDeviceConfigCache(config: DeviceConfig) {
    try {
      wx.setStorageSync(`device_config_${config.deviceId}`, config);
    } catch (error) {
      console.warn("[device-list] save config cache failed:", error);
    }
  },

  /**
   * 供其他页面调用，直接更新设备列表中的配置显示
   */
  updateDeviceConfig(config: DeviceConfig) {
    const { devices } = this.data;
    const index = devices.findIndex((d) => d.id === config.deviceId);
    if (index === -1) return;

    const device = { ...devices[index] };
    this.applyConfigToDevice(device, config);
    this.setData({ [`devices[${index}]`]: device });
    this.saveDeviceConfigCache(config);
  },

  /**
   * 音量控制：跳转音量控制页
   */
  onVolumeControl(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-control/device-control?id=${id}`,
    });
  },

  /**
   * 添加设备：跳转配网页
   */
  onAddDevice() {
    wx.navigateTo({
      url: "/pages/device-provision/device-provision",
    });
  },

  /**
   * 查看对话：跳转对话记录页
   */
  onViewChat(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?id=${id}`,
    });
  },

  /**
   * 孩子姓名区域：未设置孩子档案时跳转设备设置页，已设置则不响应
   */
  onChildNameTap(event: WechatMiniprogram.TouchEvent) {
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
  onSettingsTap(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/device-setting/device-setting?id=${id}`,
    });
  },

  /**
   * 下拉刷新：静默刷新，列表保持渲染
   */
  async onPullDownRefresh() {
    await this.loadDeviceList({ silent: true });
    wx.stopPullDownRefresh();
  },
});
