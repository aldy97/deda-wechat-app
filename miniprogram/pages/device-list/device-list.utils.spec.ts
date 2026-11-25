import {
  buildCardCopy,
  buildDeviceListSignature,
  buildStatusTag,
  formatDurationMinutes,
  isTodayUsageFresh,
  localDateKey,
  smoothBatteryDisplay,
  smoothChargingDisplay,
} from "./device-list.utils";

const usage = (turnCount: number, durationMinutes: number) => ({
  date: "2026-11-25",
  durationMinutes,
  turnCount,
});

describe("formatDurationMinutes", () => {
  it("不足 1 小时只展示分钟", () => {
    expect(formatDurationMinutes(0)).toBe("0 分钟");
    expect(formatDurationMinutes(23)).toBe("23 分钟");
    expect(formatDurationMinutes(59)).toBe("59 分钟");
  });

  it("整小时不展示 0 分钟", () => {
    expect(formatDurationMinutes(60)).toBe("1 小时");
    expect(formatDurationMinutes(120)).toBe("2 小时");
  });

  it("超过 1 小时展示小时与分钟", () => {
    expect(formatDurationMinutes(61)).toBe("1 小时 1 分钟");
    expect(formatDurationMinutes(125)).toBe("2 小时 5 分钟");
  });
});

describe("localDateKey / isTodayUsageFresh", () => {
  it("按本地日期生成 YYYY-MM-DD", () => {
    expect(localDateKey(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05");
  });

  it("缓存中的旧日期不算今日数据", () => {
    const now = new Date(2026, 10, 25, 8, 0);
    expect(isTodayUsageFresh(usage(1, 1), now)).toBe(true);
    expect(isTodayUsageFresh({ ...usage(1, 1), date: "2026-11-24" }, now)).toBe(
      false,
    );
    expect(isTodayUsageFresh(null, now)).toBe(false);
  });
});

describe("buildCardCopy", () => {
  it("今日有对话：只展示时长与句数，不重复顶部状态", () => {
    expect(buildCardCopy(usage(7, 4))).toEqual({
      title: "今天陪伴 4 分钟",
      subtitle: "说了 7 句话",
      desc: "",
    });
  });

  it("时长超过 1 小时：按小时+分钟展示", () => {
    expect(buildCardCopy(usage(10, 65))).toEqual({
      title: "今天陪伴 1 小时 5 分钟",
      subtitle: "说了 10 句话",
      desc: "",
    });
  });

  it("今日零对话：只给事实，不附状态或引导", () => {
    expect(buildCardCopy(usage(0, 0))).toEqual({
      title: "今天还没和 Elly 聊天",
      subtitle: "",
      desc: "",
    });
  });

  it("todayUsage 为 null：正文留空，交给最近活跃行", () => {
    expect(buildCardCopy(null)).toEqual({ title: "", subtitle: "", desc: "" });
  });

  it("todayUsage 缺失：正文留空", () => {
    expect(buildCardCopy(undefined)).toEqual({
      title: "",
      subtitle: "",
      desc: "",
    });
  });
});

describe("buildStatusTag", () => {
  it("加载中显示连接中，不提前判离线", () => {
    expect(buildStatusTag({ statusLoading: true })).toEqual({
      label: "连接中",
      tone: "offline",
    });
  });

  it("404 显示设备不存在", () => {
    expect(buildStatusTag({ statusNotFound: true, status: "offline" })).toEqual(
      { label: "设备不存在", tone: "offline" },
    );
  });

  it("在线/离线按契约展示", () => {
    expect(buildStatusTag({ status: "online" })).toEqual({
      label: "在线",
      tone: "online",
    });
    expect(buildStatusTag({ status: "offline" })).toEqual({
      label: "离线",
      tone: "offline",
    });
  });

  it("状态未知且非加载中：按离线兜底", () => {
    expect(buildStatusTag({})).toEqual({ label: "离线", tone: "offline" });
  });
});

describe("buildDeviceListSignature（60s 轮询的渲染去重判据）", () => {
  const base = () => [
    {
      id: "d1",
      status: "online" as const,
      battery: 65,
      isCharging: false,
      networkMode: "wifi" as const,
      networkBadge: {
        tone: "warning" as const,
        text: "WiFi",
        level: 2 as const,
      },
      statusNotFound: false,
      lastActiveText: "最近活跃 1 分钟前",
      cardTitle: "今天聊了 12 分钟",
      cardSubtitle: "3 轮对话",
      cardDesc: "一起读了绘本",
      statusLabel: "在线",
      statusTone: "online" as const,
      todayUsage: {
        date: "2026-11-25",
        durationMinutes: 12,
        turnCount: 3,
      },
    },
  ];

  it("同一快照签名稳定", () => {
    expect(buildDeviceListSignature(base())).toBe(
      buildDeviceListSignature(base()),
    );
  });

  it("空列表签名稳定", () => {
    expect(buildDeviceListSignature([])).toBe(buildDeviceListSignature([]));
  });

  it.each([
    ["电量", { battery: 60 }],
    ["状态", { status: "offline" as const }],
    [
      "徽标格数",
      {
        networkBadge: {
          tone: "danger" as const,
          text: "WiFi",
          level: 1 as const,
        },
      },
    ],
    ["卡片标题", { cardTitle: "今天还没聊" }],
    ["最近活跃", { lastActiveText: "最近活跃 2 分钟前" }],
    [
      "今日对话轮数",
      { todayUsage: { date: "2026-11-25", durationMinutes: 12, turnCount: 4 } },
    ],
  ])("%s 变化即视为需要重渲染", (_label, patch) => {
    const next = base();
    Object.assign(next[0], patch);
    expect(buildDeviceListSignature(next)).not.toBe(
      buildDeviceListSignature(base()),
    );
  });

  it("非展示字段（statusLoading）不参与签名", () => {
    const prev = base() as any[];
    const next = base() as any[];
    next[0].statusLoading = true;
    next[0].wifiRssi = -45;
    expect(buildDeviceListSignature(next)).toBe(buildDeviceListSignature(prev));
  });
});

describe("smoothBatteryDisplay（电量显示 deadband）", () => {
  it("首轮直接用原始值", () => {
    expect(smoothBatteryDisplay(null, 65)).toBe(65);
  });

  it("变化小于 2 个百分点：沿用旧显示", () => {
    expect(smoothBatteryDisplay(65, 66)).toBe(65);
    expect(smoothBatteryDisplay(65, 64)).toBe(65);
  });

  it("变化达到 2 个百分点：接受新值", () => {
    expect(smoothBatteryDisplay(65, 63)).toBe(63);
    expect(smoothBatteryDisplay(65, 67)).toBe(67);
  });

  it("未上报（null）立即清空显示", () => {
    expect(smoothBatteryDisplay(65, null)).toBeNull();
  });
});

describe("smoothChargingDisplay（插拔抖动需连续两轮确认）", () => {
  it("首轮没有原始快照：直接用原始值", () => {
    expect(smoothChargingDisplay(null, null, true)).toBe(true);
  });

  it("原始值刚变化：沿用旧显示", () => {
    expect(smoothChargingDisplay(false, false, true)).toBe(false);
  });

  it("连续两轮原始值一致：接受新显示", () => {
    expect(smoothChargingDisplay(false, true, true)).toBe(true);
  });

  it("未上报（null）立即清空显示", () => {
    expect(smoothChargingDisplay(true, true, null)).toBeNull();
  });
});
