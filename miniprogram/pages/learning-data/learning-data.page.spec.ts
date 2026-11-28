/** “更懂TA”家长日报页：三类汇报、设备切换、异常状态与反馈。 */
import { installPageHarness } from "../../tests/page-harness";
import { REPORT_FOCUS_DEVICE_KEY } from "../../constants/report-focus";

declare const __dirname: string;

const mockApi = {
  ensureAuthToken: jest.fn(),
  getDeviceList: jest.fn(),
  getLearningStatsDaily: jest.fn(),
  getLearningStatsModeUsage: jest.fn(),
  getParentReport: jest.fn(),
  submitParentReportFeedback: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const devices = [
  {
    id: "d1",
    name: "Elly 一号",
    childProfile: { name: "小明", gender: "male" },
  },
  {
    id: "d2",
    name: "Elly 二号",
    childProfile: { name: "小红", gender: "female" },
  },
];

function parentReport(deviceId = "d1") {
  return {
    deviceId,
    reportDate: "2026-10-30",
    generatedAt: "2026-10-31T23:05:00",
    durationMinutes: 20,
    modeUsage: [
      { mode: "free_chat", count: 17 },
      { mode: "daily_adventure", count: 4 },
    ],
    summary: {
      expressionObservation: "愿意主动表达。",
      emotionObservation: "整体情绪平稳。",
      thinkingObservation: "会主动提出问题。",
      suggestion: "继续顺着兴趣聊下去。",
    },
    habits: [],
    feedback: null,
  };
}

function modeUsage(deviceId = "d1") {
  return {
    deviceId,
    startDate: "2026-10-25",
    endDate: "2026-10-31",
    actualDays: 7,
    totalCount: 21,
    modeUsage: [
      { mode: "free_chat", count: 17 },
      { mode: "daily_adventure", count: 4 },
    ],
  };
}

describe("learning-data parent report page", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./learning-data");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    mockApi.ensureAuthToken.mockResolvedValue("token");
    mockApi.getDeviceList.mockResolvedValue({ data: devices });
    mockApi.getLearningStatsDaily.mockResolvedValue({
      data: [
        { date: "2026-10-30", durationMinutes: 20, sessionCount: 4 },
        { date: "2026-10-31", durationMinutes: 0, sessionCount: 0 },
      ],
    });
    mockApi.getLearningStatsModeUsage.mockImplementation((deviceId: string) =>
      Promise.resolve({ data: modeUsage(deviceId) }),
    );
    mockApi.getParentReport.mockImplementation((deviceId: string) =>
      Promise.resolve({ data: parentReport(deviceId) }),
    );
    mockApi.submitParentReportFeedback.mockResolvedValue({
      data: { reportDate: "2026-10-30", feedback: "useful" },
    });
  });

  it("loads daily trend, rolling mode usage and parent report independently", async () => {
    await page.onLoad();
    await page.onReady();

    expect(mockApi.ensureAuthToken).toHaveBeenCalled();
    expect(mockApi.getLearningStatsDaily).toHaveBeenCalledWith("d1", 7, {
      scope: "all",
    });
    expect(mockApi.getLearningStatsModeUsage).toHaveBeenCalledWith("d1", 7);
    expect(mockApi.getParentReport).toHaveBeenCalledWith(
      "d1",
      page.data.reportDate,
    );
    expect(page.data.trendBars).toHaveLength(2);
    expect(page.data.modeUsage[0]).toMatchObject({
      label: "自由对话",
      percent: 81,
      color: "var(--color-mode-1)",
    });
    expect(page.data.modeUsage[1]).toMatchObject({
      label: "每日冒险",
      percent: 19,
    });
    expect(page.data.usageActualDays).toBe(7);
    expect(page.data.usagePieVisible).toBe(true);
    expect(page.data.hasSummaryContent).toBe(true);
    expect(page.data.reportGeneratedAt).toBe("2026-10-31 23:05");
  });

  it("maps all approved mode keys to their Chinese labels", () => {
    const items = [
      { mode: "free_chat_casual", count: 1 },
      { mode: "free_chat_roleplay", count: 1 },
      { mode: "free_chat_qa", count: 1 },
      { mode: "english_chat", count: 1 },
      { mode: "english_story", count: 1 },
      { mode: "idiom_story", count: 1 },
      { mode: "sleep_story", count: 1 },
      { mode: "free_story", count: 1 },
      { mode: "adventure_story", count: 1 },
      { mode: "unknown", count: 1 },
    ];

    expect(page.buildModeUsage(items).map((item: any) => item.label)).toEqual([
      "自由闲聊",
      "角色扮演",
      "百科问答",
      "英语对话",
      "英语故事",
      "成语故事",
      "哄睡故事",
      "自由故事",
      "冒险故事",
      "其他",
    ]);
  });

  it("keeps unrecognized mode keys visible for diagnosis", () => {
    expect(
      page.buildModeUsage([{ mode: "future_mode", count: 1 }])[0].label,
    ).toBe("future_mode");
  });

  it("waits for both chart layouts before initializing the native canvas", async () => {
    let resolveDaily!: (value: any) => void;
    mockApi.getLearningStatsDaily.mockReturnValue(
      new Promise((resolve) => {
        resolveDaily = resolve;
      }),
    );

    page.onLoad();
    const loading = page.onReady();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(page.data.modeUsage).toHaveLength(2);
    expect(page.pendingPieItems).toHaveLength(2);
    expect(harness.wx.createSelectorQuery).not.toHaveBeenCalled();

    resolveDaily({ data: [] });
    await loading;

    expect(harness.wx.createSelectorQuery).toHaveBeenCalledTimes(1);
  });

  it("retries canvas initialization when the native node is not ready", async () => {
    jest.useFakeTimers();
    const context = {
      scale: jest.fn(),
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      fillStyle: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(context),
    };
    const query: any = {
      in: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      fields: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockImplementationOnce((callback) => callback([{}]))
        .mockImplementationOnce((callback) =>
          callback([{ node: canvas, width: 200, height: 200 }]),
        ),
    };
    harness.wx.createSelectorQuery.mockReturnValue(query);
    harness.wx.getWindowInfo = jest.fn().mockReturnValue({ pixelRatio: 2 });

    try {
      await page.onLoad();
      await page.onReady();
      expect(query.exec).toHaveBeenCalledTimes(1);
      expect(page.pieContext).toBeNull();

      jest.advanceTimersByTime(100);

      expect(query.exec).toHaveBeenCalledTimes(2);
      expect(page.pieContext).toBe(context);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(400);
      expect(page.pieSegments).toHaveLength(2);
      expect(context.fill).toHaveBeenCalledTimes(2);
    } finally {
      page.onUnload();
      jest.useRealTimers();
    }
  });

  it("shows the real report generation time in the usage help modal", async () => {
    await page.onLoad();
    await page.onReady();

    page.onUsageHelp();

    expect(harness.wx.showModal).toHaveBeenCalledWith({
      title: "功能使用情况",
      content: "统计结果取自近 7 天内的数据。\n报告生成时间：2026-10-31 23:05",
      showCancel: false,
      confirmText: "确定",
    });
  });

  it("does not invent an update time when generatedAt is unavailable", async () => {
    mockApi.getParentReport.mockResolvedValue({
      data: { ...parentReport("d1"), generatedAt: null },
    });
    await page.onLoad();
    await page.onReady();

    page.onUsageHelp();

    expect(harness.wx.showModal).toHaveBeenCalledWith({
      title: "功能使用情况",
      content:
        "统计结果取自近 7 天内的数据。\n暂未取得本次报告的生成时间，请稍后重试。",
      showCancel: false,
      confirmText: "确定",
    });
  });

  it("shows the tapped pie segment and clears selection outside the circle", async () => {
    const rect = { left: 50, top: 50, width: 200, height: 200 };
    const query: any = {
      in: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      boundingClientRect: jest.fn((callback) => {
        callback(rect);
        return query;
      }),
      fields: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };
    harness.wx.createSelectorQuery.mockReturnValue(query);
    await page.onLoad();
    await page.onReady();
    query.exec.mockClear();
    expect(page.data.modeUsage).toHaveLength(2);
    expect(page.pieSegments).toEqual([]);
    expect(page.findModeUsageAt(50, 50, 200, 200)).toMatchObject({
      label: "每日冒险",
      percent: 19,
    });

    page.onUsagePieTap({
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });
    expect(page.data.activeModeUsage).toMatchObject({
      label: "每日冒险",
      percent: 19,
    });

    page.onUsagePieTap({
      changedTouches: [{ clientX: 200, clientY: 150 }],
    });
    expect(page.data.activeModeUsage).toMatchObject({
      label: "自由对话",
      percent: 81,
    });

    page.onUsagePieTap({
      changedTouches: [{ clientX: 300, clientY: 150 }],
    });
    expect(page.data.activeModeUsage).toBeNull();
    expect(query.exec).toHaveBeenCalledTimes(3);

    page.onUsagePieTap({
      changedTouches: [{ clientX: 200, clientY: 150 }],
    });
    expect(page.data.activeModeUsage).not.toBeNull();
    page.onDismissUsageTooltip({ target: { id: "usagePieCanvas" } });
    expect(page.data.activeModeUsage).not.toBeNull();
    page.onDismissUsageTooltip();
    expect(page.data.activeModeUsage).toBeNull();
  });

  it("does not request reports when no device is bound", async () => {
    mockApi.getDeviceList.mockResolvedValue({ data: [] });

    await page.onLoad();
    await page.onReady();

    expect(mockApi.getLearningStatsDaily).not.toHaveBeenCalled();
    expect(mockApi.getLearningStatsModeUsage).not.toHaveBeenCalled();
    expect(mockApi.getParentReport).not.toHaveBeenCalled();
    expect(page.data.devices).toEqual([]);
    expect(page.data.loadingReport).toBe(false);
    expect(page.data.loadingUsage).toBe(false);
  });

  it("distinguishes device failure from an empty device list", async () => {
    mockApi.getDeviceList.mockRejectedValue(new Error("offline"));

    await page.onLoad();
    await page.onReady();

    expect(page.data.deviceError).toBe(true);
    expect(page.data.initialized).toBe(true);
    expect(page.data.loadingDevices).toBe(false);
    expect(page.data.loadingUsage).toBe(false);
  });

  it("首载把当前孩子写入共享选择", async () => {
    await page.onLoad();
    await page.onReady();

    expect(page.data.selectedDeviceId).toBe("d1");
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "selected_device_id",
      "d1",
    );
  });

  it("缓存首帧：按共享选择直出对应孩子", () => {
    harness.wx.getStorageSync.mockImplementation((key: string) => {
      if (key === "device_list_cache") return devices;
      if (key === "selected_device_id") return "d2";
      return "";
    });
    try {
      page.warmupFromCache();

      expect(page.data.selectedDeviceId).toBe("d2");
      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
        { id: "d2", name: "小红", gender: "female" },
      ]);
    } finally {
      harness.wx.getStorageSync.mockImplementation(() => "");
    }
  });

  it("设备切换走共享 dropdown 组件，页面不再维护展开态", () => {
    const fs = require("fs");
    const path = require("path");
    const wxml = fs.readFileSync(
      path.join(__dirname, "learning-data.wxml"),
      "utf8",
    );
    const json = JSON.parse(
      fs.readFileSync(path.join(__dirname, "learning-data.json"), "utf8"),
    );

    expect(wxml).toContain("<device-switch-dropdown");
    expect(wxml).toContain('bind:change="onDeviceChange"');
    expect(wxml).not.toContain("device-dropdown");
    expect(json.usingComponents["device-switch-dropdown"]).toBe(
      "/components/device-switch-dropdown/device-switch-dropdown",
    );
    expect(page.onDeviceSwitch).toBeUndefined();
    expect(page.onCloseDeviceDropdown).toBeUndefined();
    expect(page.onSelectDeviceOption).toBeUndefined();
    expect(page.data.deviceDropdownVisible).toBeUndefined();
  });

  it("从 dropdown 选择孩子：落 storage 并重载该孩子报告", async () => {
    await page.onLoad();
    await page.onReady();
    jest.clearAllMocks();

    await page.onDeviceChange({ detail: { deviceId: "d2" } });

    expect(page.data.selectedDeviceId).toBe("d2");
    // 胶囊头像跟着切到该孩子的性别
    expect(page.data.selectedDeviceGender).toBe("female");
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "selected_device_id",
      "d2",
    );
    expect(mockApi.getLearningStatsModeUsage).toHaveBeenCalledWith("d2", 7);
    expect(mockApi.getParentReport).toHaveBeenCalledWith(
      "d2",
      page.data.reportDate,
    );
  });

  it("冷启动沿用上次选中的孩子（跨页共享选择）", async () => {
    harness.wx.getStorageSync.mockImplementation((key: string) =>
      key === "selected_device_id" ? "d2" : "",
    );
    try {
      await page.onLoad();
      await page.onReady();

      expect(page.data.selectedDeviceId).toBe("d2");
      expect(page.data.selectedDeviceName).toBe("小红");
    } finally {
      harness.wx.getStorageSync.mockImplementation(() => "");
    }
  });

  it("keeps the current charts visible while the next child is loading", async () => {
    await page.onLoad();
    await page.onReady();
    const previousTrend = page.data.trendBars;
    const previousUsage = page.data.modeUsage;
    let resolveDaily!: (value: any) => void;
    let resolveReport!: (value: any) => void;
    let resolveUsage!: (value: any) => void;
    mockApi.getLearningStatsDaily.mockReturnValue(
      new Promise((resolve) => {
        resolveDaily = resolve;
      }),
    );
    mockApi.getParentReport.mockReturnValue(
      new Promise((resolve) => {
        resolveReport = resolve;
      }),
    );
    mockApi.getLearningStatsModeUsage.mockReturnValue(
      new Promise((resolve) => {
        resolveUsage = resolve;
      }),
    );

    const switching = page.selectDevice("d2");

    expect(page.data.trendBars).toBe(previousTrend);
    expect(page.data.modeUsage).toBe(previousUsage);
    expect(page.data.loadingDaily).toBe(true);
    expect(page.data.loadingReport).toBe(true);
    expect(page.data.loadingUsage).toBe(true);

    resolveDaily({ data: [] });
    resolveReport({ data: parentReport("d2") });
    resolveUsage({ data: modeUsage("d2") });
    await switching;
  });

  it("ignores stale chart responses after rapid child switches", async () => {
    await page.onLoad();
    await page.onReady();
    const pendingDaily = new Map<string, (value: any) => void>();
    const pendingReports = new Map<string, (value: any) => void>();
    const pendingUsage = new Map<string, (value: any) => void>();
    mockApi.getLearningStatsDaily.mockImplementation(
      (deviceId: string) =>
        new Promise((resolve) => {
          pendingDaily.set(deviceId, resolve);
        }),
    );
    mockApi.getParentReport.mockImplementation(
      (deviceId: string) =>
        new Promise((resolve) => {
          pendingReports.set(deviceId, resolve);
        }),
    );
    mockApi.getLearningStatsModeUsage.mockImplementation(
      (deviceId: string) =>
        new Promise((resolve) => {
          pendingUsage.set(deviceId, resolve);
        }),
    );

    const firstSwitch = page.selectDevice("d2");
    const latestSwitch = page.selectDevice("d1");
    pendingDaily.get("d1")!({
      data: [{ date: "2026-10-31", durationMinutes: 1, sessionCount: 1 }],
    });
    pendingReports.get("d1")!({
      data: { ...parentReport("d1"), durationMinutes: 99 },
    });
    pendingUsage.get("d1")!({
      data: {
        ...modeUsage("d1"),
        totalCount: 1,
        modeUsage: [{ mode: "daily_adventure", count: 1 }],
      },
    });
    await latestSwitch;

    pendingDaily.get("d2")!({
      data: [{ date: "2026-10-31", durationMinutes: 50, sessionCount: 5 }],
    });
    pendingReports.get("d2")!({ data: parentReport("d2") });
    pendingUsage.get("d2")!({ data: modeUsage("d2") });
    await firstSwitch;

    expect(page.data.selectedDeviceId).toBe("d1");
    expect(page.data.durationMinutes).toBe(99);
    expect(page.data.trendBars[0].value).toBe(1);
    expect(page.data.modeUsage[0].mode).toBe("daily_adventure");
  });

  it("loads the selected child report after switching device", async () => {
    await page.onLoad();
    await page.onReady();
    jest.clearAllMocks();

    await page.selectDevice("d2");

    expect(page.data.selectedDeviceName).toBe("小红");
    expect(page.data.modeUsage[0].percent).toBe(81);
    expect(mockApi.getLearningStatsDaily).toHaveBeenCalledWith("d2", 7, {
      scope: "all",
    });
    expect(mockApi.getLearningStatsModeUsage).toHaveBeenCalledWith("d2", 7);
    expect(mockApi.getParentReport).toHaveBeenCalledWith(
      "d2",
      page.data.reportDate,
    );
  });

  it("marks zero-use days differently from reports still being generated", async () => {
    mockApi.getParentReport.mockResolvedValue({
      data: {
        ...parentReport(),
        durationMinutes: 0,
        modeUsage: [],
        summary: null,
      },
    });

    await page.onLoad();
    await page.onReady();

    expect(page.data.hasSummaryContent).toBe(false);
    expect(page.data.hasReportActivity).toBe(false);
  });

  it("keeps usage data visible when the summary is not generated", async () => {
    mockApi.getParentReport.mockResolvedValue({
      data: { ...parentReport(), summary: null },
    });

    await page.onLoad();
    await page.onReady();

    expect(page.data.hasReportActivity).toBe(true);
    expect(page.data.modeUsage).toHaveLength(2);
    expect(page.data.hasSummaryContent).toBe(false);
  });

  it("accepts partial summary content", async () => {
    mockApi.getParentReport.mockResolvedValue({
      data: {
        ...parentReport(),
        summary: {
          expressionObservation: "只保留表达观察。",
          emotionObservation: null,
          thinkingObservation: "",
          suggestion: null,
        },
      },
    });

    await page.onLoad();
    await page.onReady();

    expect(page.data.hasSummaryContent).toBe(true);
    expect(page.data.summary.expressionObservation).toBe("只保留表达观察。");
  });

  it("keeps daily data and rolling usage when the parent report fails", async () => {
    mockApi.getParentReport.mockRejectedValue(new Error("timeout"));

    await page.onLoad();
    await page.onReady();

    expect(page.data.dailyError).toBe(false);
    expect(page.data.trendBars).toHaveLength(2);
    expect(page.data.modeUsage).toHaveLength(2);
    expect(page.data.usageError).toBe(false);
    expect(page.data.reportError).toBe(true);
    expect(page.data.loadingReport).toBe(false);
  });

  it("keeps report data when the daily request fails", async () => {
    mockApi.getLearningStatsDaily.mockRejectedValue(new Error("timeout"));

    await page.onLoad();
    await page.onReady();

    expect(page.data.dailyError).toBe(true);
    expect(page.data.reportError).toBe(false);
    expect(page.data.modeUsage).toHaveLength(2);
  });

  it("keeps the daily summary when rolling usage fails and retries independently", async () => {
    mockApi.getLearningStatsModeUsage.mockRejectedValueOnce(
      new Error("timeout"),
    );

    await page.onLoad();
    await page.onReady();

    expect(page.data.hasSummaryContent).toBe(true);
    expect(page.data.reportError).toBe(false);
    expect(page.data.modeUsage).toHaveLength(0);
    expect(page.data.usageError).toBe(true);
    expect(page.data.loadingUsage).toBe(false);

    mockApi.getLearningStatsModeUsage.mockResolvedValueOnce({
      data: {
        ...modeUsage(),
        startDate: "2026-10-29",
        actualDays: 3,
      },
    });
    await page.onRetryUsage();

    expect(page.data.usageActualDays).toBe(3);
    expect(page.data.usageError).toBe(false);
    expect(page.data.modeUsage).toHaveLength(2);
    expect(page.data.hasSummaryContent).toBe(true);
  });

  it("handles empty rolling usage without clearing the daily summary", async () => {
    mockApi.getLearningStatsModeUsage.mockResolvedValue({
      data: {
        ...modeUsage(),
        actualDays: 0,
        totalCount: 0,
        modeUsage: [],
      },
    });

    await page.onLoad();
    await page.onReady();

    expect(page.data.usageActualDays).toBe(0);
    expect(page.data.modeUsage).toEqual([]);
    expect(page.data.usagePieVisible).toBe(false);
    expect(page.data.hasSummaryContent).toBe(true);
    expect(page.data.usageError).toBe(false);
  });

  it("缓存恢复后 usage 静默刷新期间：usageActualDays 保持可用（副标题不随 loadingUsage 闪隐）", async () => {
    page.onLoad(); // 设定 reportDate
    const cacheKey = page.reportCacheKey("d1");
    const reportCache = {
      cachedAt: Date.now(),
      trendBars: [],
      modeUsage: [
        {
          mode: "free_chat",
          label: "自由对话",
          count: 17,
          percent: 81,
          color: "var(--color-mode-1)",
        },
      ],
      usageActualDays: 7,
      durationMinutes: 20,
      summary: null,
      hasSummaryContent: false,
      hasReportActivity: true,
      feedback: null,
      reportGeneratedAt: "2026-10-31 23:05",
    };
    harness.wx.getStorageSync.mockImplementation((key: string) =>
      key === cacheKey ? reportCache : "",
    );
    try {
      expect(page.restoreReportCache("d1")).toBe(true);
      expect(page.data.usageActualDays).toBe(7);
      // loadUsageStats 有过期请求守卫，需与当前选中设备一致
      page.setData({ selectedDeviceId: "d1" });

      // usage 接口未返回（静默刷新进行中）：副标题数据必须保持
      let resolveUsage!: (v: unknown) => void;
      mockApi.getLearningStatsModeUsage.mockReturnValue(
        new Promise((resolve) => {
          resolveUsage = resolve;
        }),
      );
      const pending = page.loadUsageStats("d1");
      await Promise.resolve();

      expect(page.data.loadingUsage).toBe(true);
      expect(page.data.usageActualDays).toBe(7);
      expect(page.data.usageError).toBe(false);

      resolveUsage({ data: modeUsage() });
      await pending;
      expect(page.data.loadingUsage).toBe(false);
      expect(page.data.usageActualDays).toBe(7);
    } finally {
      harness.wx.getStorageSync.mockImplementation(() => "");
    }
  });

  it("submits boolean feedback with deviceId and reportDate", async () => {
    await page.onLoad();
    await page.onReady();

    await page.onFeedback({ currentTarget: { dataset: { useful: true } } });

    expect(mockApi.submitParentReportFeedback).toHaveBeenCalledWith({
      deviceId: "d1",
      reportDate: page.data.reportDate,
      useful: true,
    });
    expect(page.data.feedback).toBe("useful");
  });

  it("keeps the unanswered state and report content when submission fails", async () => {
    await page.onLoad();
    await page.onReady();
    const originalSummary = page.data.summary;
    mockApi.submitParentReportFeedback.mockRejectedValue(new Error("HTTP 500"));

    await page.onFeedback({ currentTarget: { dataset: { useful: true } } });

    expect(page.data.feedback).toBeNull();
    expect(page.data.summary).toEqual(originalSummary);
    expect(page.data.hasSummaryContent).toBe(true);
    expect(page.data.feedbackSubmitting).toBe(false);
    expect(harness.wx.showToast).toHaveBeenCalledTimes(1);
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "反馈提交失败，请重试",
      icon: "none",
    });
  });

  it("does not submit again when the report already has feedback", async () => {
    mockApi.getParentReport.mockResolvedValue({
      data: { ...parentReport("d1"), feedback: "not_useful" },
    });
    await page.onLoad();
    await page.onReady();

    await page.onFeedback({ currentTarget: { dataset: { useful: true } } });

    expect(mockApi.submitParentReportFeedback).not.toHaveBeenCalled();
    expect(page.data.feedback).toBe("not_useful");
    expect(harness.wx.showToast).not.toHaveBeenCalled();
  });

  it("allows retrying feedback after a failed submission", async () => {
    await page.onLoad();
    await page.onReady();
    mockApi.submitParentReportFeedback.mockRejectedValueOnce(
      new Error("HTTP 500"),
    );

    await page.onFeedback({ currentTarget: { dataset: { useful: true } } });
    await page.onFeedback({ currentTarget: { dataset: { useful: true } } });

    expect(mockApi.submitParentReportFeedback).toHaveBeenCalledTimes(2);
    expect(page.data.feedback).toBe("useful");
    expect(page.data.feedbackSubmitting).toBe(false);
    expect(harness.wx.showToast).toHaveBeenLastCalledWith({
      title: "感谢你的反馈",
      icon: "none",
    });
  });

  it("continues from the current pie frame and ignores cancelled animation frames", () => {
    const frames: Array<() => void> = [];
    let now = 0;
    const dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
    page.pieCanvas = {
      requestAnimationFrame: (callback: () => void) => frames.push(callback),
    };
    page.pieSize = 200;
    page.drawUsagePie = jest.fn();
    page.pieHasRendered = true;
    page.pieSegments = [
      {
        mode: "free_chat",
        color: "color-a",
        startAngle: 0,
        endAngle: 360,
      },
    ];

    page.startUsagePieAnimation([
      { mode: "free_chat", count: 1, paintColor: "color-a" },
      { mode: "daily_adventure", count: 1, paintColor: "color-b" },
    ]);
    now = 240;
    frames[0]();
    const staleFrame = frames[1];

    page.startUsagePieAnimation([
      { mode: "daily_adventure", count: 1, paintColor: "color-b" },
    ]);
    const drawCount = page.drawUsagePie.mock.calls.length;
    staleFrame();
    expect(page.drawUsagePie).toHaveBeenCalledTimes(drawCount);

    now = 720;
    frames[2]();
    expect(page.pieSegments).toHaveLength(1);
    expect(page.pieSegments[0]).toMatchObject({
      mode: "daily_adventure",
      startAngle: 0,
      endAngle: 360,
    });
    dateSpy.mockRestore();
  });

  it("prevents duplicate feedback submission", async () => {
    await page.onLoad();
    await page.onReady();
    let resolveFeedback!: (value: any) => void;
    mockApi.submitParentReportFeedback.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFeedback = resolve;
        }),
    );

    const first = page.onFeedback({
      currentTarget: { dataset: { useful: "true" } },
    });
    const second = page.onFeedback({
      currentTarget: { dataset: { useful: "true" } },
    });
    expect(mockApi.submitParentReportFeedback).toHaveBeenCalledTimes(1);

    resolveFeedback({ data: { feedback: "useful" } });
    await Promise.all([first, second]);
    expect(page.data.feedbackSubmitting).toBe(false);
  });

  it("falls back to raw mode key for unmapped modes", () => {
    // 历史统计数据可能含有已下线的 mode key（如教材模式）；
    // 未映射时必须展示原始 key 而不炸。
    const usage = page.buildModeUsage([{ mode: "legacy_mode", count: 1 }]);
    expect(usage).toHaveLength(1);
    expect(usage[0].label).toBe("legacy_mode");
  });

  describe("设备列表刷新时序（空 → 绑定后回来必须解除空态）", () => {
    it("首载无设备，onShow 时重拉设备列表并解除空态", async () => {
      // 首载：无设备
      mockApi.getDeviceList.mockResolvedValueOnce({ data: [] });
      await page.onLoad();
      await page.onReady();
      expect(page.data.devices).toEqual([]);
      expect(page.data.selectedDeviceId).toBe("");

      // 用户在设备页完成绑定后回到本页
      await page.onShow();

      // 重拉了设备列表（而不是只刷报告数据）
      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);
      expect(page.data.devices).toHaveLength(2);
      expect(page.data.selectedDeviceId).toBe("d1");
      // dropdown 也要拿到新增设备（空态 → 两个孩子）
      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
        { id: "d2", name: "小红", gender: "female" },
      ]);
      // 解除空态后报告数据随之加载
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d1",
        page.data.reportDate,
      );
    });

    it("已有设备时 onShow 静默同步设备列表并刷报告（列表可能被首页解绑改过）", async () => {
      await page.onLoad();
      await page.onReady();
      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(1);

      await page.onShow();

      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);
      expect(mockApi.getParentReport).toHaveBeenCalledTimes(2);
    });

    it("首页解绑当前孩子后回到本页：dropdown 不再包含该孩子，选中回退第一台并重拉报告", async () => {
      await page.onLoad();
      await page.onReady();
      await page.selectDevice("d2");
      jest.clearAllMocks();

      // 首页删掉了 d2：服务端只剩 d1
      mockApi.getDeviceList.mockResolvedValue({ data: [devices[0]] });

      await page.onShow();

      expect(page.data.devices.map((d: any) => d.id)).toEqual(["d1"]);
      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
      ]);
      expect(page.data.selectedDeviceId).toBe("d1");
      expect(page.data.selectedDeviceName).toBe("小明");
      expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
        "selected_device_id",
        "d1",
      );
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d1",
        page.data.reportDate,
      );
    });

    it("首页解绑其他孩子后回到本页：只更新 dropdown，当前孩子不变", async () => {
      await page.onLoad();
      await page.onReady();
      jest.clearAllMocks();

      // 当前是 d1，首页删掉了 d2
      mockApi.getDeviceList.mockResolvedValue({ data: [devices[0]] });

      await page.onShow();

      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
      ]);
      expect(page.data.selectedDeviceId).toBe("d1");
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d1",
        page.data.reportDate,
      );
    });

    it("首页新增孩子后回到本页：dropdown 动态增加，当前孩子与报告不变", async () => {
      mockApi.getDeviceList.mockResolvedValueOnce({ data: [devices[0]] });
      await page.onLoad();
      await page.onReady();
      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
      ]);
      jest.clearAllMocks();

      // 首页新增了 d2
      mockApi.getDeviceList.mockResolvedValue({ data: devices });

      await page.onShow();

      expect(page.data.deviceOptions).toEqual([
        { id: "d1", name: "小明", gender: "male" },
        { id: "d2", name: "小红", gender: "female" },
      ]);
      expect(page.data.selectedDeviceId).toBe("d1");
      expect(page.data.selectedDeviceName).toBe("小明");
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d1",
        page.data.reportDate,
      );
    });

    it("同步设备列表失败：保留旧列表与当前孩子，不崩", async () => {
      await page.onLoad();
      await page.onReady();
      jest.clearAllMocks();
      jest.spyOn(console, "warn").mockImplementation(() => undefined);

      mockApi.getDeviceList.mockRejectedValue(new Error("offline"));

      await page.onShow();

      expect(page.data.devices).toHaveLength(2);
      expect(page.data.selectedDeviceId).toBe("d1");
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d1",
        page.data.reportDate,
      );
      (console.warn as jest.Mock).mockRestore();
    });

    it("下拉刷新时无选中设备：走 initialize 重拉设备列表", async () => {
      mockApi.getDeviceList.mockResolvedValueOnce({ data: [] });
      await page.onLoad();
      await page.onReady();
      expect(page.data.selectedDeviceId).toBe("");

      await page.onPullDownRefresh();

      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);
      expect(page.data.selectedDeviceId).toBe("d1");
      expect(harness.wx.stopPullDownRefresh).toHaveBeenCalled();
    });
  });

  describe("设备卡片直达（查看成长报告）：自动选中对应设备", () => {
    beforeEach(() => {
      // 交接 key 只在用例内显式注入，避免上个用例的 implementation 泄漏
      harness.wx.getStorageSync.mockImplementation(() => "");
    });

    function pendingDevice(deviceId: string) {
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === REPORT_FOCUS_DEVICE_KEY ? deviceId : "",
      );
    }

    it("冷启动带交接设备：优先选中该设备并消费 key", async () => {
      pendingDevice("d2");

      await page.onLoad();
      await page.onReady();

      expect(page.data.selectedDeviceId).toBe("d2");
      expect(page.data.selectedDeviceName).toBe("小红");
      expect(mockApi.getParentReport).toHaveBeenCalledWith(
        "d2",
        page.data.reportDate,
      );
      expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
        REPORT_FOCUS_DEVICE_KEY,
      );
    });

    it("交接设备已解绑：回退第一台并清掉失效 key", async () => {
      pendingDevice("gone");

      await page.onLoad();
      await page.onReady();

      expect(page.data.selectedDeviceId).toBe("d1");
      expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
        REPORT_FOCUS_DEVICE_KEY,
      );
    });

    it("页面已加载后收到交接：设备列表同步后仍按交接优先切过去", async () => {
      await page.onLoad();
      await page.onReady();
      expect(page.data.selectedDeviceId).toBe("d1");

      pendingDevice("d2");
      await page.onShow();

      expect(page.data.selectedDeviceId).toBe("d2");
      // 每次回页都会同步设备列表（解绑后 dropdown 不能残留旧孩子）
      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);
      expect(harness.wx.removeStorageSync).toHaveBeenCalledTimes(1);
    });

    it("交接只消费一次：之后用户手动切走，onShow 不会把人拉回来", async () => {
      pendingDevice("d2");
      await page.onLoad();
      await page.onReady();
      expect(page.data.selectedDeviceId).toBe("d2");

      // 用户在报告页手动切回 d1
      await page.selectDevice("d1");
      harness.wx.getStorageSync.mockImplementation(() => "");
      await page.onShow();

      expect(page.data.selectedDeviceId).toBe("d1");
      expect(harness.wx.removeStorageSync).toHaveBeenCalledTimes(1);
    });
  });
});
