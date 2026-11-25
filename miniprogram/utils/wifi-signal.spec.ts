/**
 * 网络徽标映射：服务端 status 的 networkMode/wifiRssi 常显规则（方案 B）。
 *
 * 产品口径（2026-11-24 熊总确认）：
 * - 在线时永远展示网络类型（WiFi / 4G）与信号强度；
 * - WiFi 以信号格呈现：>= -50 dBm 3 格（好），-70 ~ -50 2 格（一般），< -70 1 格（弱）；
 * - 4G 只展示类型标签，不展示格数（4G 没有 WiFi 信号强度）；
 * - 离线 / 未知 / 切网中 / 脏数据一律不展示：Redis 里可能是一小时前的旧值。
 */
import { describeNetworkBadge, smoothNetworkBadge } from "./wifi-signal";

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

describe("smoothNetworkBadge（信号格滞回，压住阈值附近抖动）", () => {
  const online = (wifiRssi: number | null) => ({
    status: "online" as const,
    networkMode: "wifi" as const,
    wifiRssi,
  });
  const level3 = { tone: "neutral", text: "WiFi", level: 3 } as const;
  const level2 = { tone: "warning", text: "WiFi", level: 2 } as const;
  const level1 = { tone: "danger", text: "WiFi", level: 1 } as const;

  it("没有上一轮值：直接返回本次结果", () => {
    expect(smoothNetworkBadge(null, online(-52))).toEqual(level2);
  });

  it("档位没变：跟随本次数据", () => {
    expect(smoothNetworkBadge(level3, online(-45))).toEqual(level3);
    expect(smoothNetworkBadge(level1, online(-85))).toEqual(level1);
  });

  it("升档需越过阈值 5dBm：-48 仍保持 2 格，-45 才升 3 格", () => {
    expect(smoothNetworkBadge(level2, online(-48))).toEqual(level2);
    expect(smoothNetworkBadge(level2, online(-45))).toEqual(level3);
  });

  it("降档需跌破阈值 5dBm：-52 仍保持 3 格，-56 才降 2 格", () => {
    expect(smoothNetworkBadge(level3, online(-52))).toEqual(level3);
    expect(smoothNetworkBadge(level3, online(-56))).toEqual(level2);
  });

  it("1↔2 边界同样滞回：-72 保持 2 格、-76 才降 1 格；-68 保持 1 格、-64 才升 2 格", () => {
    expect(smoothNetworkBadge(level2, online(-72))).toEqual(level2);
    expect(smoothNetworkBadge(level2, online(-76))).toEqual(level1);
    expect(smoothNetworkBadge(level1, online(-68))).toEqual(level1);
    expect(smoothNetworkBadge(level1, online(-64))).toEqual(level2);
  });

  it("大跨度跃升按第一道坎判定：1→3 只要越过 -65 即接受本次档位", () => {
    expect(smoothNetworkBadge(level1, online(-66))).toEqual(level1);
    expect(smoothNetworkBadge(level1, online(-65))).toEqual(level2);
    expect(smoothNetworkBadge(level1, online(-48))).toEqual(level3);
  });

  it("WiFi↔4G、在线↔离线立即生效，不做滞回", () => {
    expect(
      smoothNetworkBadge(level3, {
        status: "online",
        networkMode: "4g",
        wifiRssi: null,
      }),
    ).toEqual({ tone: "neutral", text: "4G", level: null });
    expect(
      smoothNetworkBadge(level3, {
        status: "offline",
        networkMode: "wifi",
        wifiRssi: -40,
      }),
    ).toBeNull();
  });

  it("脏数据（非整数/正数）立即清空，不沿用旧格", () => {
    expect(smoothNetworkBadge(level2, online(-61.5))).toBeNull();
    expect(smoothNetworkBadge(level2, online(5))).toBeNull();
  });
});
