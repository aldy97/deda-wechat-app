/**
 * 设备网络徽标映射（服务端 status 的 networkMode / wifiRssi）。
 *
 * 产品口径（2026-11-24 熊总确认，方案 B 常显）：
 * - 在线时永远展示网络类型（WiFi / 4G）与信号强度；
 * - WiFi 以信号格呈现：>= -50 dBm 3 格（好），-70 ~ -50 2 格（一般），< -70 1 格
 *   （弱）；格数与 tone 一一对应（3=neutral / 2=warning / 1=danger）；
 * - 4G 只展示类型标签，格数为 null（4G 没有 WiFi 信号强度概念）；
 * - 离线 / 未知 / 切网中 / 脏数据一律不展示：Redis 里可能是一小时前的旧值。
 */

export type NetworkMode = "wifi" | "4g" | null;

export interface NetworkBadge {
  tone: "neutral" | "warning" | "danger";
  /** 网络类型标签：WiFi / 4G */
  text: string;
  /** WiFi 信号格数（1~3）；4G 与未知为 null */
  level: 1 | 2 | 3 | null;
}

/** 达到该值即满格（3 格） */
const GOOD_RSSI = -50;
/** 低于该值只剩 1 格 */
const POOR_RSSI = -70;

export function describeNetworkBadge(input: {
  status?: string | null;
  networkMode?: NetworkMode;
  wifiRssi?: number | null;
}): NetworkBadge | null {
  if (input.status !== "online") return null;
  if (input.networkMode === "4g") {
    return { tone: "neutral", text: "4G", level: null };
  }
  if (input.networkMode !== "wifi") return null;

  const rssi = input.wifiRssi;
  if (typeof rssi !== "number" || !Number.isInteger(rssi) || rssi >= 0) {
    return null;
  }
  if (rssi >= GOOD_RSSI) return { tone: "neutral", text: "WiFi", level: 3 };
  if (rssi >= POOR_RSSI) return { tone: "warning", text: "WiFi", level: 2 };
  return { tone: "danger", text: "WiFi", level: 1 };
}
