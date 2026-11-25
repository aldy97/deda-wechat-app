import {
  ensureAuthToken,
  getDeviceAboutInfo,
  getDeviceStatus,
} from "../../api/api";
import {
  buildDiagnosticSections,
  buildDiagnosticsText,
  buildLocalEnv,
  DiagnosticSection,
  RawLocalEnv,
  settle,
  StatusError,
} from "./about-device.utils";

/** 读取本地环境信息；任一 API 不可用时由 buildLocalEnv 回退为「未获取」 */
function readRawLocalEnv(): RawLocalEnv {
  const raw: RawLocalEnv = {};
  try {
    raw.appBaseInfo = wx.getAppBaseInfo();
  } catch (error) {
    console.warn("[about-device] getAppBaseInfo failed", error);
  }
  try {
    raw.deviceInfo = wx.getDeviceInfo();
  } catch (error) {
    console.warn("[about-device] getDeviceInfo failed", error);
  }
  return raw;
}

/**
 * 关于设备页（客服诊断视图）
 * 聚合设备详情、实时状态与本地环境；任一接口失败只影响对应分组。
 * 可截图，也可一键复制完整诊断文本。
 */
Page({
  data: {
    deviceId: "",
    loading: true,
    refreshing: false,
    sections: [] as DiagnosticSection[],
    /** 详情请求失败时与「暂无设备信息」区分文案 */
    loadFailed: false,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId });
  },

  onReady() {
    return this.fetchDiagnostics();
  },

  async fetchDiagnostics(options?: { silent?: boolean }) {
    const { deviceId } = this.data;
    if (!deviceId) {
      this.setData({
        loading: false,
        refreshing: false,
        sections: [],
        loadFailed: false,
      });
      return;
    }

    if (!options?.silent) {
      this.setData({ loading: true });
    }
    this.setData({ refreshing: true, loadFailed: false });

    try {
      try {
        await ensureAuthToken();
      } catch (error) {
        // 令牌刷新失败仍继续尝试请求，401 由 request.ts 统一处理
        console.warn("[about-device] ensureAuthToken failed", error);
      }

      const [detailResult, statusResult] = await Promise.all([
        settle(getDeviceAboutInfo(deviceId)),
        settle(getDeviceStatus(deviceId)),
      ]);

      const detail = detailResult.ok ? detailResult.value.data : null;
      if (!detail) {
        if (detailResult.ok) {
          // 设备不存在/未绑定：正常空态，不弹错误
          this.setData({ sections: [], loadFailed: false });
        } else {
          wx.showToast({ title: "加载失败", icon: "none" });
          this.setData({ sections: [], loadFailed: true });
        }
        return;
      }

      const status = statusResult.ok ? statusResult.value.data : null;
      const statusError: StatusError = statusResult.ok
        ? null
        : (statusResult.reason as { statusCode?: number })?.statusCode === 404
          ? "not-found"
          : "failed";
      const env = buildLocalEnv(readRawLocalEnv());
      const sections = buildDiagnosticSections({
        detail,
        status,
        statusError,
        env,
      });

      this.setData({ sections, loadFailed: false });
    } catch (error) {
      wx.showToast({ title: "加载失败", icon: "none" });
      this.setData({ sections: [], loadFailed: true });
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  /** 重新检测：静默刷新设备状态，不整页转圈 */
  onRefresh() {
    if (this.data.loading || this.data.refreshing) return;
    return this.fetchDiagnostics({ silent: true });
  },

  /** 复制完整诊断文本，方便家长直接粘贴给客服 */
  onCopyDiagnostics() {
    const text = buildDiagnosticsText(this.data.sections);
    if (!text) return;

    wx.setClipboardData({
      data: text,
      fail: () => {
        wx.showToast({ title: "复制失败", icon: "none" });
      },
    });
  },

  /** 点击可复制行：写入剪贴板（成功提示由微信原生提供） */
  onCopyRow(event: WechatMiniprogram.TouchEvent) {
    const value = String(event?.currentTarget?.dataset?.value ?? "");
    if (!value) return;

    wx.setClipboardData({
      data: value,
      fail: () => {
        wx.showToast({ title: "复制失败", icon: "none" });
      },
    });
  },
});
