import {
  buildCardCopy,
  buildStatusTag,
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
