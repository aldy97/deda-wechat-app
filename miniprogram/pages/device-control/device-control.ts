import {
  controlDeviceVolume,
  getDeviceStatus,
} from "../../api/api";
import {
  normalizeVolume,
  snapVolumeDown,
  snapVolumeUp,
  VOLUME_MAX,
  VOLUME_MIN,
} from "../../utils/volume";

/** 状态接口报错对象上可能携带的 HTTP 状态码（request.ts 注入） */
interface HttpError {
  statusCode?: number;
}

/** 前台状态轮询间隔：10s（设备心跳 5s，两个心跳周期内可感知上线/离线） */
const STATUS_POLL_INTERVAL_MS = 10 * 1000;

/** 提交成功后等待设备回读的静默窗口：窗口内不用旧状态覆盖乐观值 */
const VOLUME_SYNC_GRACE_MS = 6 * 1000;

/**
 * 音量控制页
 * 契约 3.6：仅 action=volume 真实下发到设备；电源/工作模式协议未支持，
 * 本页不展示相关占位（2026-11-26 移除对话模式与占位死代码）。
 *
 * 当前音量来自契约 3.4 `GET /devices/:id/status` 的 `volume`（设备 query 心跳
 * 上报的真实值），不读本机缓存猜测——猜测值会导致「显示 60、实际 35，
 * 点一下减号反而调到 50」这类越调越偏的问题。
 * 音量未知（volume 为 null / 状态请求失败）时两个按钮一律禁用，宁可不可用
 * 也不下发基于猜测值的指令；设备离线时同样禁用（离线不可调节音量）。
 *
 * 页面可见时每 10 秒静默刷新一次状态：设备重新上线后自动解锁，无需手动点
 * 「刷新状态」。轮询失败不回退已展示的音量与在线态，避免每 10 秒闪一次未知态；
 * 提交成功后 6 秒内不被设备尚未回读的旧音量覆盖。
 *
 * 步进规则见 utils/volume.ts：只允许以 10 为步长；当前值非整十时先归整
 * （往下 floor 到十位、往上 ceil 到十位），已是整十则 ±10。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    /** 当前音量；null = 设备未上报，音量未知 */
    volume: null as number | null,
    /** 音量是否未知（未知时按钮禁用并展示占位） */
    volumeUnknown: true,
    /** 上一次服务端确认或成功下发的音量，失败回滚目标 */
    lastCommittedVolume: null as number | null,
    /** 是否有下发请求进行中 */
    submitting: false,
    /** 提交中产生的新目标值（last-wins 补发） */
    pendingVolume: null as number | null,
    statusLoaded: false,
    statusNotFound: false,
    deviceOnline: true,
    /** 控制是否整体禁用：状态已加载且（设备不存在或离线） */
    controlDisabled: false,
    /** 减号按钮禁用态：整体禁用 / 音量未知 / 已到下界 */
    minusDisabled: true,
    /** 加号按钮禁用态：整体禁用 / 音量未知 / 已到上界 */
    plusDisabled: true,
    /** 步进器下方的状态提示文案 */
    statusHint: "",
  },

  /** 10s 前台轮询定时器（0 = 未启动） */
  statusPollTimer: 0 as any,

  /** 状态请求在途：轮询、回前台刷新与手动刷新共用，避免请求叠加 */
  statusInFlight: false,

  /** 提交成功后的静默截止时间（Unix ms）；0 = 无静默窗口 */
  volumeSyncUntil: 0,

  onLoad(options) {
    const deviceId = options?.id || "";
    if (!deviceId) {
      wx.showToast({ title: "缺少设备参数", icon: "none" });
      wx.navigateBack();
      return;
    }
    this.setData({ deviceId });
  },

  async onReady() {
    if (!this.data.deviceId) return;
    await this.refreshAll();
    this.startStatusPolling();
  },

  onShow() {
    // 首个 onShow 早于 onReady；初始加载由 onReady 负责，避免双请求
    if (!this.data.statusLoaded) return;
    this.startStatusPolling();
    void this.fetchStatus();
  },

  onHide() {
    this.stopStatusPolling();
  },

  onUnload() {
    this.stopStatusPolling();
  },

  /** 启动前台轮询：先清旧表，避免 onShow 反复触发导致定时器叠加 */
  startStatusPolling() {
    this.stopStatusPolling();
    this.statusPollTimer = setInterval(() => {
      void this.fetchStatus();
    }, STATUS_POLL_INTERVAL_MS);
  },

  stopStatusPolling() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = 0;
    }
  },

  /**
   * 刷新状态按钮
   */
  async onRefresh() {
    await this.refreshAll();
  },

  /**
   * 拉取设备状态
   */
  async refreshAll() {
    this.setData({ loading: true });
    await this.fetchStatus();
    this.setData({ loading: false });
  },

  /**
   * 拉取设备状态（3.4）：online 解锁步进器；offline/404 禁用并提示；
   * 其它异常在「在线判定」上 fail-open，但音量取不到时仍按未知处理。
   * 已加载过之后的轮询失败只记日志，保留当前展示，避免状态抖动。
   */
  async fetchStatus() {
    if (this.statusInFlight) return;
    this.statusInFlight = true;
    try {
      const res = await getDeviceStatus(this.data.deviceId);
      const reported = normalizeVolume(res.data.volume);
      const preserve = this.shouldPreserveVolume(reported);
      this.applyDeviceState({
        loaded: true,
        notFound: false,
        online: res.data.status === "online",
        volume: preserve ? this.data.volume : reported,
      });
      if (!preserve) {
        this.volumeSyncUntil = 0;
        if (reported !== null) {
          this.setData({ lastCommittedVolume: reported });
        }
      }
    } catch (error) {
      const notFound = (error as HttpError)?.statusCode === 404;
      if (!notFound) {
        console.error("[device-control] fetch status failed:", error);
      }
      if (notFound) {
        this.applyDeviceState({
          loaded: true,
          notFound: true,
          online: false,
          volume: null,
        });
      } else if (!this.data.statusLoaded) {
        this.applyDeviceState({
          loaded: true,
          notFound: false,
          // 网络异常时不武断判离线（fail-open），音量未知已足够阻止误下发
          online: true,
          volume: null,
        });
      }
    } finally {
      this.statusInFlight = false;
    }
  },

  /**
   * 是否保留当前展示音量：
   * - 下发请求在途时，轮询结果可能仍是旧值，不能让 UI 回跳；
   * - 提交成功后 6 秒内，设备尚未回读，旧值同样不能覆盖乐观值。
   */
  shouldPreserveVolume(reported: number | null): boolean {
    if (this.data.submitting) return true;
    return (
      this.volumeSyncUntil > Date.now() &&
      reported !== this.data.lastCommittedVolume
    );
  },

  /**
   * 统一落地设备状态 → 按钮禁用态与提示文案
   */
  applyDeviceState(state: {
    loaded: boolean;
    notFound: boolean;
    online: boolean;
    volume: number | null;
  }) {
    const controlDisabled = state.loaded && (state.notFound || !state.online);
    let statusHint = "";
    if (state.loaded) {
      if (state.notFound) {
        statusHint = "设备不存在或已解绑";
      } else if (!state.online) {
        // 离线时按钮禁用、指令根本不会下发，文案不能承诺「上线后生效」
        statusHint = "设备离线，无法调节音量";
      } else if (state.volume === null) {
        statusHint = "未获取到设备音量，请点击「刷新状态」重试";
      }
    }
    this.setData({
      statusLoaded: state.loaded,
      statusNotFound: state.notFound,
      deviceOnline: state.online,
      controlDisabled,
      statusHint,
    });
    this.applyVolume(state.volume);
  },

  /**
   * 落地音量 → 显示值与两个按钮的禁用态（乐观更新 / 失败回滚共用）
   */
  applyVolume(volume: number | null) {
    const unknown = volume === null;
    const blocked = this.data.controlDisabled || unknown;
    this.setData({
      volume,
      volumeUnknown: unknown,
      minusDisabled: blocked || (volume !== null && volume <= VOLUME_MIN),
      plusDisabled: blocked || (volume !== null && volume >= VOLUME_MAX),
    });
  },

  /** 减号：往下一档 */
  async onVolumeMinus() {
    await this.stepVolume(-1);
  },

  /** 加号：往上一档 */
  async onVolumePlus() {
    await this.stepVolume(1);
  },

  /**
   * 按 10 的步长调节一档：先算目标值再乐观更新，随后下发。
   * 音量未知 / 设备离线或不存在时不下发（按钮已禁用，此处兜底程序化调用）；
   * 已在 0 或 100 边界时目标值等于当前值，直接忽略。
   */
  async stepVolume(direction: -1 | 1) {
    const current = this.data.volume;
    if (current === null || this.data.controlDisabled) return;
    const target =
      direction < 0 ? snapVolumeDown(current) : snapVolumeUp(current);
    if (target === current) return;
    this.applyVolume(target);
    await this.submitVolume(target);
  },

  /**
   * 下发音量：进行中再收到新值时记录 pending，当前请求完成后补发最新值
   *（last-wins，不并发、不乱序，也避免连点打爆 MQTT）；失败回滚到上次成功值
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
      this.volumeSyncUntil = Date.now() + VOLUME_SYNC_GRACE_MS;
    } catch (error) {
      const notFound = (error as HttpError)?.statusCode === 404;
      const message = notFound
        ? "设备不存在或已解绑"
        : error instanceof Error
          ? error.message
          : "音量设置失败";
      wx.showToast({ title: message, icon: "none" });
      this.volumeSyncUntil = 0;
      this.applyVolume(this.data.lastCommittedVolume);
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
