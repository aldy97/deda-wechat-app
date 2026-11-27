import { reportClientInfo } from "../api/client-info";

/** 品牌变化立即上报；同品牌每 7 天补报一次，避免每次启动都写库 */
export const CLIENT_INFO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CLIENT_INFO_BRAND_KEY = "client_info_brand";
export const CLIENT_INFO_REPORTED_AT_KEY = "client_info_reported_at";

/** 读取 wx.getDeviceInfo().brand；异常/空值返回 null，调用方据此跳过上报 */
export function readClientBrand(): string | null {
  try {
    if (typeof wx === "undefined" || typeof wx.getDeviceInfo !== "function") {
      return null;
    }
    const brand = (wx.getDeviceInfo()?.brand ?? "").trim();
    return brand || null;
  } catch (error) {
    console.warn("[client-info] getDeviceInfo failed:", error);
    return null;
  }
}

/** 节流判定：品牌变化立即上报；同品牌 TTL 内跳过 */
export function shouldReportClientInfo(
  brand: string | null,
  previousBrand: string,
  reportedAt: number,
  now: number,
): boolean {
  if (!brand) return false;
  if (brand !== previousBrand) return true;
  return now - reportedAt >= CLIENT_INFO_TTL_MS;
}

function readStorage(key: string): string {
  try {
    return wx.getStorageSync(key) || "";
  } catch (error) {
    console.warn(`[client-info] read ${key} failed:`, error);
    return "";
  }
}

function writeStorage(key: string, value: string | number): void {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    console.warn(`[client-info] write ${key} failed:`, error);
  }
}

let pendingReport: Promise<void> | null = null;

/**
 * 上报家长手机品牌（best-effort）：
 * - 无 token 不上报，避免后台统计触发 401 重登录；
 * - 品牌为空不上报，避免覆盖服务端已知值；
 * - 失败只 warn，不影响启动；并发调用复用同一个 Promise。
 */
export function reportClientInfoIfNeeded(now = Date.now()): Promise<void> {
  if (pendingReport) return pendingReport;

  const token = readStorage("token");
  if (!token) return Promise.resolve();

  const brand = readClientBrand();
  if (!brand) return Promise.resolve();

  const previousBrand = readStorage(CLIENT_INFO_BRAND_KEY);
  const reportedAt = Number(readStorage(CLIENT_INFO_REPORTED_AT_KEY)) || 0;
  if (!shouldReportClientInfo(brand, previousBrand, reportedAt, now)) {
    return Promise.resolve();
  }

  pendingReport = (async () => {
    try {
      await reportClientInfo({ brand });
      writeStorage(CLIENT_INFO_BRAND_KEY, brand);
      writeStorage(CLIENT_INFO_REPORTED_AT_KEY, now);
    } catch (error) {
      console.warn("[client-info] report failed:", error);
    } finally {
      pendingReport = null;
    }
  })();

  return pendingReport;
}
