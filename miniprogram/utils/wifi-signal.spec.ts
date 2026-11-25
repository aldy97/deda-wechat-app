/**
 * 网络徽标映射：服务端 status 的 networkMode/wifiRssi 常显规则（方案 B）。
 *
 * 产品口径（2026-11-24 熊总确认）：
 * - 在线时永远展示网络类型（WiFi / 4G）与信号强度；
 * - WiFi 以信号格呈现：>= -50 dBm 3 格（好），-70 ~ -50 2 格（一般），< -70 1 格（弱）；
 * - 4G 只展示类型标签，不展示格数（4G 没有 WiFi 信号强度）；
 * - 离线 / 未知 / 切网中 / 脏数据一律不展示：Redis 里可能是一小时前的旧值。
 */
import { describeNetworkBadge } from "./wifi-signal";

describe("describeNetworkBadge", () => {
  it("离线一律不展示（缓存里的最后已知信号不可信）", () => {
    expect(
      describeNetworkBadge({
        status: "offline",
        networkMode: "wifi",
        wifiRssi: -80,
      }),
    ).toBeNull();
  });

  it("status 缺失同样不展示", () => {
    expect(
      describeNetworkBadge({ networkMode: "wifi", wifiRssi: -80 }),
    ).toBeNull();
  });

  it("4G 展示 4G 标签、无格数，即使携带了脏 RSSI", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "4g",
        wifiRssi: null,
      }),
    ).toEqual({ tone: "neutral", text: "4G", level: null });
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "4g",
        wifiRssi: -40,
      }),
    ).toEqual({ tone: "neutral", text: "4G", level: null });
  });

  it("-50 边界算「好」，3 格 neutral", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -50,
      }),
    ).toEqual({ tone: "neutral", text: "WiFi", level: 3 });
  });

  it("-30 这类强信号同样常显 3 格", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -30,
      }),
    ).toEqual({ tone: "neutral", text: "WiFi", level: 3 });
  });

  it("-51 落入「一般」，2 格 warning", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -51,
      }),
    ).toEqual({ tone: "warning", text: "WiFi", level: 2 });
  });

  it("-70 边界仍算「一般」，2 格 warning", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -70,
      }),
    ).toEqual({ tone: "warning", text: "WiFi", level: 2 });
  });

  it("-71 落入「弱」，1 格 danger", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -71,
      }),
    ).toEqual({ tone: "danger", text: "WiFi", level: 1 });
  });

  it.each([
    ["wifi 但 rssi 为 null", { networkMode: "wifi", wifiRssi: null }],
    ["切网中（mode=null）", { networkMode: null, wifiRssi: null }],
    ["老固件缺字段", {}],
    ["非整数", { networkMode: "wifi", wifiRssi: -61.5 }],
    ["脏正数", { networkMode: "wifi", wifiRssi: 5 }],
  ])("%s 不展示", (_label, patch) => {
    expect(
      describeNetworkBadge({ status: "online", ...(patch as any) }),
    ).toBeNull();
  });
});
