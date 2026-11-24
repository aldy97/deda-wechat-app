/**
 * 设备网络徽标映射（服务端 status 的 networkMode / wifiRssi）。
 *
 * 产品口径：
 * - >= -50 dBm 视为「好」，不展示——正常状态不制造视觉噪音；
 * - -70 ~ -50 展示「信号一般」；
 * - < -70 展示「信号弱」（设备固件扫描时同样以 -70 为可用边界）；
 * - 4G 展示「4G」标签，不展示信号格；
 * - 离线 / 未知 / 切网中一律不展示：Redis 里可能是一小时前的旧值。
 */

export type NetworkMode = "wifi" | "4g" | null;

export interface NetworkBadge {
  tone: "neutral" | "warning" | "danger";
  text: string;
}

/** 达到该值即视为「好」，不展示徽标 */
const GOOD_RSSI = -50;
/** 低于该值视为「弱」 */
const POOR_RSSI = -70;

export function describeNetworkBadge(input: {
  status?: string | null;
  networkMode?: NetworkMode;
  wifiRssi?: number | null;
}): NetworkBadge | null {
  if (input.status !== "online") return null;
  if (input.networkMode === "4g") return { tone: "neutral", text: "4G" };
  if (input.networkMode !== "wifi") return null;

  const rssi = input.wifiRssi;
  if (typeof rssi !== "number" || !Number.isInteger(rssi) || rssi >= 0) {
    return null;
  }
  if (rssi >= GOOD_RSSI) return null;
  if (rssi >= POOR_RSSI) return { tone: "warning", text: "信号一般" };
  return { tone: "danger", text: "信号弱" };
}
