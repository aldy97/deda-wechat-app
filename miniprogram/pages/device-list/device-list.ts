import {
  getDeviceList,
  getDeviceStatus,
  Device,
  DeviceStatus,
  DeviceTodayUsage,
  ensureAuthToken,
} from "../../api/api";
import {
  describeNetworkBadge,
  NetworkBadge,
  smoothNetworkBadge,
} from "../../utils/wifi-signal";
import {
  buildCardCopy,
  buildDeviceListSignature,
  buildStatusTag,
  isTodayUsageFresh,
  smoothBatteryDisplay,
  smoothChargingDisplay,
} from "./device-list.utils";
import { REPORT_FOCUS_DEVICE_KEY } from "../../constants/report-focus";

/** 设备列表缓存键（与 device-setting / owner-info / device-provision 的失效点保持一致） */
const DEVICE_LIST_CACHE_KEY = "device_list_cache";

/** 自定义导航栏兜底尺寸（px）：老基础库或测试环境取不到胶囊信息时使用 */
const DEFAULT_STATUS_BAR_HEIGHT = 20;
const DEFAULT_NAV_BAR_HEIGHT = 44;

/** 前台降频轮询间隔：60s（切 tab / 后台由 onHide 停表） */
const STATUS_POLL_INTERVAL = 60 * 1000;

/** 每台设备上一轮的原始状态（仅内存）：用于电量/充电态/信号格抖动平滑 */
interface RawStatusSnapshot {
  battery: number | null;
  isCharging: boolean | null;
  wifiRssi: number | null;
}

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
  /** 网络模式：null 含「切网中」与「老固件未知」，API 不区分 */
  networkMode?: "wifi" | "4g" | null;
  /** WiFi 信号强度 dBm；仅 wifi 模式有意义 */
  wifiRssi?: number | null;
  /** 信号徽标：仅「一般/弱」与 4G 展示，其余为 null */
  networkBadge?: NetworkBadge | null;
  /** status 接口返回 404（设备不存在/已被 wipe） */
  statusNotFound?: boolean;
  statusLoading?: boolean;
  /** 服务端按设备时区统计的今日陪伴摘要；旧服务端/统计失败为 null */
  todayUsage?: DeviceTodayUsage | null;
  /** 卡片正文文案（由 buildCardCopy 派生，不写缓存） */
  cardTitle?: string;
  cardSubtitle?: string;
  cardDesc?: string;
  /** 顶部状态标签（由 buildStatusTag 派生，不写缓存） */
  statusLabel?: string;
  statusTone?: "online" | "offline";
}

/**
 * 设备列表页
 * 从后端拉取当前登录用户的真实绑定设备；空列表展示空态并引导去配网绑定。
 */
Page({
  data: {
    loading: true,
    devices: [] as DeviceDisplayItem[],
    /** 自定义导航栏：状态栏高度（px） */
    statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
    /** 自定义导航栏：导航栏内容高度（px），与微信胶囊按钮垂直对齐 */
    navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
  },

  /** 首次加载是否已发起（onShow 每次触发，仅在首次之后才重复拉取） */
  hasInitialLoaded: false,

  /** 60s 前台轮询定时器（0 = 未启动） */
  pollTimer: 0 as any,

  /** 列表刷新在途：轮询与下拉刷新共用，避免请求叠加 */
  refreshInFlight: false,

  /** 上一次渲染的签名：轮询到点后数据没变就不 setData */
  lastSignature: "",

  /** 每台设备上一轮的原始状态（仅内存，不渲染不缓存），用于抖动平滑 */
  lastRawStatusById: null as Map<string, RawStatusSnapshot> | null,

  onLoad() {
    this.applyNavBarMetrics();
    this.lastRawStatusById = new Map();
  },

  /**
   * 自定义导航栏尺寸：状态栏高度 + 菜单胶囊按钮的水平中线对齐。
   * 老基础库或测试环境取不到胶囊信息时退回 20 / 44 默认值。
   */
  applyNavBarMetrics() {
    let statusBarHeight = DEFAULT_STATUS_BAR_HEIGHT;
    let navBarHeight = DEFAULT_NAV_BAR_HEIGHT;

    try {
      const info = wx.getWindowInfo();
      if (typeof info?.statusBarHeight === "number") {
        statusBarHeight = info.statusBarHeight;
      }

      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && menu.top >= statusBarHeight && menu.height > 0) {
        navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
      }
    } catch (error) {
      // 取不到胶囊信息时保留默认值，页面仍可正常渲染
    }

    this.setData({ statusBarHeight, navBarHeight });
  },

  onReady() {
    return this.loadDeviceList().then(() => {
      this.startStatusPolling();
    });
  },

  onShow() {
    // 真机首个 onShow 早于 onReady，跳过避免双请求；之后每次回前台静默刷新并重启计时
    if (this.hasInitialLoaded) {
      this.loadDeviceList({ silent: true });
      this.startStatusPolling();
    }
  },

  onHide() {
    this.stopStatusPolling();
  },

  onUnload() {
    this.stopStatusPolling();
  },

  /** 启动 60s 前台降频轮询（页面可见时才跑，先清旧表避免重复计时） */
  startStatusPolling() {
    this.stopStatusPolling();
    this.pollTimer = setInterval(() => {
      this.pollDevicesOnce();
    }, STATUS_POLL_INTERVAL);
  },

  stopStatusPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = 0;
    }
  },

  /** 轮询一轮：走静默刷新；已有请求在途时跳过，避免叠加 */
  pollDevicesOnce() {
    if (this.refreshInFlight) return;
    return this.loadDeviceList({ silent: true });
  },

  /**
   * 加载设备列表（SWR）：
   * - 无缓存首次进入：整页 loading
   * - 有缓存：首帧直出缓存快照，后台刷新后原地更新
   * - silent（回前台/下拉刷新）：不翻 loading、不清空列表，失败保留旧数据
   */
  async loadDeviceList(options?: { silent?: boolean }) {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;

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
      const signature = buildDeviceListSignature(displayItems);
      this.writeDeviceListCache(displayItems);
      if (signature !== this.lastSignature) {
        this.lastSignature = signature;
        this.setData({ devices: displayItems, loading: false });
      }
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
    } finally {
      this.refreshInFlight = false;
    }
  },

  /**
   * 读取设备列表缓存用于首帧直出；返回是否有可用缓存。
   * 缓存里的 todayUsage 跨天即作废，并按最新数据重算卡片文案。
   */
  restoreDeviceListCache(): boolean {
    try {
      const cached = wx.getStorageSync(DEVICE_LIST_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        const now = new Date();
        const devices = cached.map((item: DeviceDisplayItem) => {
          const next: DeviceDisplayItem = {
            ...item,
            todayUsage: isTodayUsageFresh(item.todayUsage, now)
              ? item.todayUsage
              : null,
          };
          this.applyCardCopy(next);
          this.applyStatusTag(next);
          return next;
        });
        this.setData({ devices, loading: false });
        return true;
      }
    } catch (error) {
      console.warn("[device-list] 读取设备列表缓存失败", error);
    }
    return false;
  },

  /**
   * 写入设备列表缓存（剔除 statusLoading 与卡片派生文案，恢复时重算）
   */
  writeDeviceListCache(items: DeviceDisplayItem[]) {
    try {
      wx.setStorageSync(
        DEVICE_LIST_CACHE_KEY,
        items.map((item) => {
          const snapshot = { ...item };
          delete snapshot.statusLoading;
          delete snapshot.cardTitle;
          delete snapshot.cardSubtitle;
          delete snapshot.cardDesc;
          delete snapshot.statusLabel;
          delete snapshot.statusTone;
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
   * 为设备列表补充状态，并生成状态驱动的卡片文案。
   * 静默刷新时传入 previous：沿用旧状态/电量快照，避免「电量...」闪烁；
   * todayUsage 始终以本次列表响应为准，不接受旧快照覆盖。
   */
  async enrichDevices(
    devices: Device[],
    previous?: DeviceDisplayItem[],
  ): Promise<DeviceDisplayItem[]> {
    const previousById = new Map(
      (previous || []).map((item) => [item.id, item]),
    );
    if (!this.lastRawStatusById) {
      this.lastRawStatusById = new Map();
    }
    const rawStatusById = this.lastRawStatusById;
    return Promise.all(
      devices.map(async (device) => {
        const prev = previousById.get(device.id);
        const prevRaw = rawStatusById.get(device.id);
        const item: DeviceDisplayItem = {
          ...device,
          todayUsage: device.todayUsage ?? null,
          statusLoading: !prev,
          // 静默刷新：先展示旧快照，接口返回后再原地更新
          ...(prev
            ? {
                status: prev.status,
                battery: prev.battery,
                isCharging: prev.isCharging,
                lastActiveAt: prev.lastActiveAt,
                lastActiveText: prev.lastActiveText,
                networkMode: prev.networkMode,
                wifiRssi: prev.wifiRssi,
                networkBadge: prev.networkBadge,
                statusNotFound: prev.statusNotFound,
              }
            : {}),
        };
        this.applyCardCopy(item);
        this.applyStatusTag(item);

        try {
          const status = await this.fetchDeviceStatus(item.id);
          if (status === null) {
            // status 404：设备不存在（可能已解绑/被 wipe），给兜底态，不弹窗不白屏
            item.statusNotFound = true;
            item.status = "offline";
            item.todayUsage = null;
            item.battery = null;
            item.isCharging = null;
            item.networkMode = null;
            item.wifiRssi = null;
            item.networkBadge = null;
            item.lastActiveAt = null;
            rawStatusById.delete(item.id);
          } else {
            const nextRaw: RawStatusSnapshot = {
              battery: status.battery ?? null,
              isCharging: status.isCharging ?? null,
              wifiRssi: status.wifiRssi ?? null,
            };
            item.status = status.status;
            item.battery = smoothBatteryDisplay(
              prev?.battery ?? null,
              nextRaw.battery,
            );
            item.isCharging = smoothChargingDisplay(
              prev?.isCharging ?? null,
              prevRaw?.isCharging ?? null,
              nextRaw.isCharging,
            );
            item.networkMode = status.networkMode ?? null;
            item.wifiRssi = nextRaw.wifiRssi;
            item.networkBadge = smoothNetworkBadge(prev?.networkBadge ?? null, {
              status: item.status,
              networkMode: item.networkMode,
              wifiRssi: item.wifiRssi,
            });
            item.lastActiveAt = status.lastActiveAt;
            item.lastActiveText = this.formatLastActive(status.lastActiveAt);
            rawStatusById.set(item.id, nextRaw);
          }
        } catch (error) {
          item.status = item.status || "offline";
          // 状态拉取失败不等于设备没电：保持 null，由 WXML 展示「--」
          item.battery = item.battery ?? null;
          item.isCharging = item.isCharging ?? null;
        } finally {
          item.statusLoading = false;
          this.applyCardCopy(item);
          this.applyStatusTag(item);
        }

        return item;
      }),
    );
  },

  /**
   * 根据今日陪伴摘要生成卡片正文（状态信息由顶部承担）
   */
  applyCardCopy(item: DeviceDisplayItem) {
    const copy = buildCardCopy(item.todayUsage);
    item.cardTitle = copy.title;
    item.cardSubtitle = copy.subtitle;
    item.cardDesc = copy.desc;
  },

  /**
   * 顶部状态标签：加载中显示「连接中」，避免冷启动误标离线
   */
  applyStatusTag(item: DeviceDisplayItem) {
    const tag = buildStatusTag({
      status: item.status,
      statusLoading: item.statusLoading,
      statusNotFound: item.statusNotFound,
    });
    item.statusLabel = tag.label;
    item.statusTone = tag.tone;
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
        networkMode: null,
        wifiRssi: null,
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
   * 添加设备：跳转配网页
   */
  onAddDevice() {
    wx.navigateTo({
      url: "/pages/device-provision/device-provision",
    });
  },

  /**
   * 来信反馈 banner：跳转反馈页
   */
  onFeedbackHeroTap() {
    wx.navigateTo({
      url: "/pages/feedback/feedback",
    });
  },

  /**
   * 查看对话：跳转对话记录页
   *
   * 2026-11-25 起卡片入口已隐藏（对话记录功能暂时下线）；方法保留，
   * app-routing 的可达性判定依赖源码里的静态导航目标。恢复时放开装置卡注释段并补回样式。
   */
  onViewChat(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?id=${id}`,
    });
  },

  /**
   * 查看成长报告：把设备 id 交接给「更懂TA」tab 后切换过去。
   * 该页是 tabBar 页面，只能用 switchTab 且不能带 query，因此走 storage 交接。
   */
  onViewReport(event: WechatMiniprogram.TouchEvent) {
    const id = String(event?.currentTarget?.dataset?.id || "");
    if (!id) return;

    try {
      wx.setStorageSync(REPORT_FOCUS_DEVICE_KEY, id);
    } catch (error) {
      console.warn("[device-list] 写入报告设备交接失败", error);
    }

    wx.switchTab({
      url: "/pages/learning-data/learning-data",
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
