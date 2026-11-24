/**
 * 网络徽标映射：服务端 status 的 networkMode/wifiRssi 三态规则。
 *
 * 产品口径（2026-11-24 熊总确认）：
 * - >= -50 dBm 视为「好」，不展示（正常状态不制造噪音）；
 * - -70 ~ -50 展示「信号一般」；
 * - < -70 展示「信号弱」；
 * - 4G 展示「4G」标签，不展示格数（4G 没有 WiFi 信号强度）；
 * - 离线 / 未知 / 切网中一律不展示。
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

  it("4G 展示 4G 标签，即使携带了脏 RSSI", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "4g",
        wifiRssi: null,
      }),
    ).toEqual({ tone: "neutral", text: "4G" });
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "4g",
        wifiRssi: -40,
      }),
    ).toEqual({ tone: "neutral", text: "4G" });
  });

  it("-50 边界算「好」，不展示", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -50,
      }),
    ).toBeNull();
  });

  it("-30 这类强信号不展示", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -30,
      }),
    ).toBeNull();
  });

  it("-51 落入「信号一般」", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -51,
      }),
    ).toEqual({ tone: "warning", text: "信号一般" });
  });

  it("-70 边界仍算「信号一般」", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -70,
      }),
    ).toEqual({ tone: "warning", text: "信号一般" });
  });

  it("-71 落入「信号弱」", () => {
    expect(
      describeNetworkBadge({
        status: "online",
        networkMode: "wifi",
        wifiRssi: -71,
      }),
    ).toEqual({ tone: "danger", text: "信号弱" });
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
