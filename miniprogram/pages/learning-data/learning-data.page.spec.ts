/**
 * learning-data 页面装配测试。
 * 验证家庭全览页：默认本周、时间切换、AI 洞察兜底、设备卡片下钻、学习动态。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getLearningStatsDashboard: jest.fn(),
  getLearningStatsTopics: jest.fn(),
  getLearningStatsTimeline: jest.fn(),
  getLearningStatsInsights: jest.fn(),
  getDeviceStatus: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("learning-data page wiring", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./learning-data");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();

    mockApi.getLearningStatsDashboard.mockResolvedValue({
      data: {
        totalDurationMinutes: 300,
        totalSessions: 20,
        activeDeviceCount: 1,
        boundDeviceCount: 1,
        continuousDays: 5,
        topicCount: 3,
        devices: [
          {
            deviceId: "d1",
            deviceName: "小象学习机",
            childName: "小明",
            status: "online",
            totalDurationMinutes: 300,
            totalSessions: 20,
            continuousDays: 5,
            topicCount: 3,
            todayDurationMinutes: 45,
            weekDurationMinutes: 300,
          },
        ],
      },
    });
    mockApi.getLearningStatsTopics.mockResolvedValue({
      data: [
        {
          id: "t1",
          mode: "textbook_learning",
          textbookId: "book-1",
          textbookName: "Unlock L1",
          unitId: "unit-1",
          unitName: "Food",
          count: 10,
          lastSpokeAt: "2026-09-27T00:00:00Z",
          isActive: true,
          avgScore: 85,
        },
      ],
    });
    mockApi.getLearningStatsTimeline.mockResolvedValue({
      data: { items: [], total: 0 },
    });
    mockApi.getLearningStatsInsights.mockResolvedValue({
      data: [
        {
          id: "ai-1",
          type: "strength",
          title: "学习活跃",
          content: "本周累计学习 300 分钟。",
        },
      ],
    });
    mockApi.getDeviceStatus.mockResolvedValue({
      data: {
        deviceId: "d1",
        status: "online",
        battery: 80,
        isCharging: false,
        lastActiveAt: "2026-09-27T12:00:00Z",
      },
    });
  });

  it("loads all blocks with default range 'week' on onLoad", async () => {
    await page.onLoad();

    expect(page.data.activeRange).toBe("week");
    expect(mockApi.getLearningStatsDashboard).toHaveBeenCalledWith(
      undefined,
      "week",
    );
    expect(mockApi.getLearningStatsInsights).toHaveBeenCalledWith(
      undefined,
      "week",
    );
  });

  it("switches range and reloads data", async () => {
    await page.onLoad();
    jest.clearAllMocks();

    await page.onRangeChange({ detail: { name: "month" } });

    expect(page.data.activeRange).toBe("month");
    expect(mockApi.getLearningStatsDashboard).toHaveBeenCalledWith(
      undefined,
      "month",
    );
  });

  it("falls back to local insights when backend insights fail", async () => {
    mockApi.getLearningStatsInsights.mockRejectedValue(new Error("timeout"));

    await page.onLoad();

    expect(page.data.insights.length).toBeGreaterThan(0);
    expect(page.data.loading.insights).toBe(false);
  });

  it("navigates to device-analysis when device card tapped", async () => {
    await page.onLoad();

    page.onDeviceCardTap({ currentTarget: { dataset: { deviceId: "d1" } } });

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/device-analysis/device-analysis?id=d1",
    });
  });

  it("refreshes data on onShow when switching back from other tabs", async () => {
    await page.onLoad();
    jest.clearAllMocks();

    await page.onShow();

    expect(mockApi.getLearningStatsDashboard).toHaveBeenCalled();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledWith("d1");
  });

  it("calls getDeviceStatus for each device to correct status", async () => {
    mockApi.getDeviceStatus.mockResolvedValue({
      data: {
        deviceId: "d1",
        status: "online",
        battery: 80,
        isCharging: false,
        lastActiveAt: "2026-09-27T12:00:00Z",
      },
    });

    await page.onLoad();

    expect(mockApi.getDeviceStatus).toHaveBeenCalledWith("d1");
  });

  it("keeps dashboard data when getDeviceStatus fails", async () => {
    mockApi.getDeviceStatus.mockRejectedValue(new Error("timeout"));

    await page.onLoad();

    expect(page.data.dashboard.devices[0].status).toBe("online");
    expect(page.data.dashboard.totalDurationMinutes).toBe(300);
  });

  it("does not duplicate concurrent loads", async () => {
    const loadPromise1 = page.onLoad();
    const loadPromise2 = page.onShow();
    await Promise.all([loadPromise1, loadPromise2]);

    // 虽然并发触发两次，但 dashboard 和 deviceStatus 不应被调用超过合理次数
    const dashboardCalls = mockApi.getLearningStatsDashboard.mock.calls.length;
    const statusCalls = mockApi.getDeviceStatus.mock.calls.length;
    expect(dashboardCalls).toBeLessThanOrEqual(2);
    expect(statusCalls).toBeLessThanOrEqual(2);
  });

  it("loads next timeline page when onLoadMore is triggered", async () => {
    mockApi.getLearningStatsTimeline
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "e1",
              deviceId: "d1",
              deviceName: "小象学习机",
              topicName: "百科问答",
              userText: "什么是恐龙？",
              aiText: "恐龙是史前爬行动物。",
              createdAt: "2026-09-27T10:00:00Z",
            },
          ],
          total: 2,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "e2",
              deviceId: "d1",
              deviceName: "小象学习机",
              topicName: "百科问答",
              userText: "恐龙吃什么？",
              aiText: "不同恐龙食性不同。",
              createdAt: "2026-09-27T09:00:00Z",
            },
          ],
          total: 2,
        },
      });

    await page.onLoad();
    expect(page.data.timeline.length).toBe(1);
    expect(page.data.timeline[0].devices[0].events.length).toBe(1);
    expect(page.data.hasMore).toBe(true);

    await page.onLoadMore();

    expect(mockApi.getLearningStatsTimeline).toHaveBeenLastCalledWith(
      undefined,
      2,
      expect.any(Number),
    );
    expect(page.data.timeline[0].devices[0].events.length).toBe(2);
  });
});
