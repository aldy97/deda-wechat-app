import {
  controlDeviceVolume,
  getDeviceStatus,
  getDeviceCurrentConfig,
  DeviceConfig,
  ensureAuthToken,
} from "../../api/api";

/** Vant 组件 change 事件，detail 为当前值 */
interface VantNumberEvent {
  detail: number;
}

/** 模式展示名映射 */
const MODE_DISPLAY_MAP: Record<string, string> = {
  free_chat: "自由对话",
};

/** 无缓存时的默认音量（契约无音量查询接口，仅能记住本机上次下发值） */
const DEFAULT_VOLUME = 60;

/** 状态接口报错对象上可能携带的 HTTP 状态码（request.ts 注入） */
interface HttpError {
  statusCode?: number;
}

/**
 * 音量控制页
 * 契约 3.6：仅 action=volume 真实下发到设备；电源/工作模式协议未支持，
 * UI 灰显占位（敬请期待），不制造「已生效」的错觉。
 * 页面加载时拉取设备状态（3.4）：离线/不存在时滑块置灰并提示。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    /** 当前滑块显示值 */
    volume: DEFAULT_VOLUME,
    /** 上一次成功下发（或初始缓存）的音量，失败回滚目标 */
    lastCommittedVolume: DEFAULT_VOLUME,
    /** 是否有下发请求进行中 */
    submitting: false,
    /** 提交中产生的新目标值（last-wins 补发） */
    pendingVolume: null as number | null,
    statusLoaded: false,
    statusNotFound: false,
    deviceOnline: true,
    /** 滑块是否置灰：状态已加载且（设备不存在或离线） */
    sliderDisabled: false,
    /** 滑块下方的状态提示文案 */
    statusHint: "",
    currentConfig: null as DeviceConfig | null,
    currentModeDisplay: "",
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    if (!deviceId) {
      wx.showToast({ title: "缺少设备参数", icon: "none" });
      wx.navigateBack();
      return;
    }
    this.setData({ deviceId });

    // 初始音量：读本机缓存的上次下发值（无查询接口的折衷）
    try {
      const cached = wx.getStorageSync(`device_volume_${deviceId}`);
      if (typeof cached === "number" && cached >= 0 && cached <= 100) {
        this.setData({ volume: cached, lastCommittedVolume: cached });
      }
    } catch (error) {
      // 缓存读取失败按默认值处理
    }
  },

  async onReady() {
    if (!this.data.deviceId) return;
    await this.refreshAll();
  },

  /**
   * 刷新状态按钮
   */
  async onRefresh() {
    await this.refreshAll();
  },

  /**
   * 拉取设备状态 + 当前配置
   */
  async refreshAll() {
    this.setData({ loading: true });
    await Promise.all([
      this.fetchStatus(),
      this.fetchCurrentConfig(this.data.deviceId),
    ]);
    this.setData({ loading: false });
  },

  /**
   * 拉取设备状态（3.4）：online 解锁滑块；offline/404 置灰并提示；
   * 其它异常 fail-open 不阻塞控制
   */
  async fetchStatus() {
    try {
      const res = await getDeviceStatus(this.data.deviceId);
      this.applyStatusState({
        loaded: true,
        notFound: false,
        online: res.data.status === "online",
      });
    } catch (error) {
      if ((error as HttpError)?.statusCode === 404) {
        this.applyStatusState({ loaded: true, notFound: true, online: false });
      } else {
        console.error("[device-control] fetch status failed:", error);
        this.applyStatusState({ loaded: true, notFound: false, online: true });
      }
    }
  },

  /**
   * 统一落地状态 → 滑块可用性与提示文案
   */
  applyStatusState(state: {
    loaded: boolean;
    notFound: boolean;
    online: boolean;
  }) {
    const sliderDisabled = state.loaded && (state.notFound || !state.online);
    const statusHint = !state.loaded
      ? ""
      : state.notFound
        ? "设备不存在或已解绑"
        : state.online
          ? ""
          : "设备离线，指令将在设备上线后生效";
    this.setData({
      statusLoaded: state.loaded,
      statusNotFound: state.notFound,
      deviceOnline: state.online,
      sliderDisabled,
      statusHint,
    });
  },

  /**
   * 拉取当前对话模式配置
   */
  async fetchCurrentConfig(deviceId: string) {
    try {
      await ensureAuthToken();
      const res = await getDeviceCurrentConfig(deviceId);
      const config = res.data;
      this.setData({
        currentConfig: config,
        currentModeDisplay: this.formatModeDisplay(config),
      });
      wx.setStorageSync(`device_config_${deviceId}`, config);
    } catch (error) {
      console.error("[device-control] fetch current config failed:", error);
    }
  },

  /**
   * 格式化模式展示文本
   */
  formatModeDisplay(config: DeviceConfig): string {
    const modeName = MODE_DISPLAY_MAP[config.mode] || config.mode;
    if (config.mode === "free_chat" && config.conversationModeKey) {
      return `${modeName} / ${config.conversationModeKey}`;
    }
    return modeName;
  },

  /**
   * 音量滑块拖动中：只改本地显示，不发请求
   */
  onVolumeChange(event: VantNumberEvent) {
    this.setData({ volume: event.detail });
  },

  /**
   * 音量滑块松手：提交下发
   */
  async onVolumeDragEnd(event: VantNumberEvent) {
    const volume = event.detail;
    this.setData({ volume });
    // 防御：离线/设备不存在时不下发（滑块已置灰，此处兜底程序化调用）
    if (this.data.sliderDisabled) return;
    await this.submitVolume(volume);
  },

  /**
   * 下发音量：进行中再收到新值时记录 pending，当前请求完成后补发最新值
   *（last-wins，不并发、不乱序）；失败回滚到上次成功值
   */
  async submitVolume(volume: number): Promise<void> {
    if (this.data.submitting) {
      this.setData({ pendingVolume: volume });
      return;
    }
    this.setData({ submitting: true });
    try {
      await controlDeviceVolume(this.data.deviceId, volume);
      this.setData({ lastCommittedVolume: volume });
      try {
        wx.setStorageSync(`device_volume_${this.data.deviceId}`, volume);
      } catch (error) {
        console.warn("[device-control] save volume cache failed:", error);
      }
    } catch (error) {
      const notFound = (error as HttpError)?.statusCode === 404;
      const message = notFound
        ? "设备不存在或已解绑"
        : error instanceof Error
          ? error.message
          : "音量设置失败";
      wx.showToast({ title: message, icon: "none" });
      this.setData({ volume: this.data.lastCommittedVolume });
    } finally {
      this.setData({ submitting: false });
      const pending = this.data.pendingVolume;
      this.setData({ pendingVolume: null });
      if (pending !== null && pending !== this.data.lastCommittedVolume) {
        await this.submitVolume(pending);
      }
    }
  },
});
