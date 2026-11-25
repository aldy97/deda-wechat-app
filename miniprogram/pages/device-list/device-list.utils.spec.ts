import {
  buildCardCopy,
  formatDurationMinutes,
  isTodayUsageFresh,
  localDateKey,
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
  it("今日有对话：标题为陪伴时长，副标题为发言句数", () => {
    expect(
      buildCardCopy({ status: "online", todayUsage: usage(7, 4) }),
    ).toEqual({
      title: "今天陪伴 4 分钟",
      subtitle: "说了 7 句话",
      desc: "",
    });
  });

  it("今日有对话但设备离线：仍展示今日数据并提示检查网络", () => {
    expect(
      buildCardCopy({ status: "offline", todayUsage: usage(3, 2) }),
    ).toEqual({
      title: "今天陪伴 2 分钟",
      subtitle: "说了 3 句话",
      desc: "Elly 现在不在线，检查网络后就能继续聊。",
    });
  });

  it("在线但今天还没聊：给出开始对话的引导", () => {
    expect(
      buildCardCopy({ status: "online", todayUsage: usage(0, 0) }),
    ).toEqual({
      title: "今天还没和 Elly 聊天",
      subtitle: "",
      desc: "说一句「你好 Elly」就能开始。",
    });
  });

  it("今天没聊且离线：优先说明离线", () => {
    expect(
      buildCardCopy({ status: "offline", todayUsage: usage(0, 0) }),
    ).toEqual({
      title: "Elly 现在不在线",
      subtitle: "",
      desc: "检查网络后就能和 Elly 开始今天的第一次聊天。",
    });
  });

  it("usage 缺失且离线：提示检查网络或重新联网", () => {
    expect(buildCardCopy({ status: "offline", todayUsage: null })).toEqual({
      title: "Elly 现在不在线",
      subtitle: "",
      desc: "检查网络或重新联网后就能继续聊。",
    });
  });

  it("status 加载中且 usage 缺失：展示连接中", () => {
    expect(buildCardCopy({ statusLoading: true })).toEqual({
      title: "正在连接 Elly…",
      subtitle: "",
      desc: "",
    });
  });

  it("在线且 usage 缺失：展示在线中性文案", () => {
    expect(buildCardCopy({ status: "online", todayUsage: null })).toEqual({
      title: "Elly 在线",
      subtitle: "",
      desc: "随时可以开始聊天。",
    });
  });

  it("旧缓存没有 status：不冒充在线，提示刷新", () => {
    expect(buildCardCopy({})).toEqual({
      title: "Elly",
      subtitle: "",
      desc: "下拉刷新获取设备状态。",
    });
  });

  it("status 404：优先生成兜底文案", () => {
    expect(
      buildCardCopy({
        statusNotFound: true,
        status: "offline",
        todayUsage: usage(5, 3),
      }),
    ).toEqual({
      title: "设备信息暂时不可用",
      subtitle: "",
      desc: "下拉刷新试试，或重新绑定这台设备。",
    });
  });
});
