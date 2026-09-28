import {
  generateFallbackInsights,
  calculateHealthScore,
  aggregateFamilyTrend,
  getHealthLevel,
  enrichDevicesWithStatus,
  HealthScoreResult,
} from "./learning-analytics";
import {
  LearningStatsDashboard,
  LearningStatsDailyPoint,
  LearningStatsTopic,
} from "../../api/api";

function dashboard(
  overrides: Partial<LearningStatsDashboard> = {},
): LearningStatsDashboard {
  return {
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
    ...overrides,
  };
}

function dailyPoints(count: number, value: number): LearningStatsDailyPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `9/${i + 1}`,
    durationMinutes: value,
    sessionCount: 2,
  }));
}

function topics(
  list: Partial<LearningStatsTopic>[] = [],
): LearningStatsTopic[] {
  return list.map((t, i) => ({
    id: `t${i}`,
    mode: "textbook_learning",
    textbookId: `book-${i}`,
    textbookName: `Book ${i}`,
    unitId: `unit-${i}`,
    unitName: `Unit ${i}`,
    conversationModeKey: null,
    conversationModeName: null,
    count: 5,
    lastSpokeAt: "2026-09-27T00:00:00Z",
    isActive: i === 0,
    avgScore: 80,
    ...t,
  })) as LearningStatsTopic[];
}

describe("learning-analytics", () => {
  describe("getHealthLevel", () => {
    it("returns excellent for score >= 85", () => {
      expect(getHealthLevel(85)).toBe("excellent");
      expect(getHealthLevel(100)).toBe("excellent");
    });

    it("returns good for score 70-84", () => {
      expect(getHealthLevel(70)).toBe("good");
      expect(getHealthLevel(84)).toBe("good");
    });

    it("returns average for score 55-69", () => {
      expect(getHealthLevel(55)).toBe("average");
      expect(getHealthLevel(69)).toBe("average");
    });

    it("returns attention for score < 55", () => {
      expect(getHealthLevel(54)).toBe("attention");
      expect(getHealthLevel(0)).toBe("attention");
    });
  });

  describe("calculateHealthScore", () => {
    it("returns a score between 0 and 100", () => {
      const result = calculateHealthScore({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("includes all dimensions", () => {
      const result = calculateHealthScore({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      expect(result.dimensions.activity).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.consistency).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.balance).toBeGreaterThanOrEqual(0);
      expect(result.dimensions.engagement).toBeGreaterThanOrEqual(0);
    });

    it("suggests attention when no learning today", () => {
      const result = calculateHealthScore({
        dashboard: dashboard({
          devices: [
            {
              ...dashboard().devices[0],
              todayDurationMinutes: 0,
            },
          ],
        }),
        trend: dailyPoints(7, 0),
        topics: topics(),
        range: "week",
      });

      expect(result.level).toBe("attention");
      expect(result.suggestion).toContain("今天");
    });

    it("returns excellent for high activity and consistency", () => {
      const result = calculateHealthScore({
        dashboard: dashboard({
          totalDurationMinutes: 600,
          continuousDays: 7,
          totalSessions: 50,
        }),
        trend: dailyPoints(7, 90),
        topics: topics([{ count: 10 }, { count: 8 }, { count: 7 }]),
        range: "week",
      });

      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.level).toBe("excellent");
    });

    it("returns default result when dashboard is empty", () => {
      const result = calculateHealthScore({
        dashboard: {} as LearningStatsDashboard,
        trend: [],
        topics: [],
        range: "week",
      });

      expect(result.score).toBe(0);
      expect(result.level).toBe("attention");
      expect(result.suggestion).toContain("数据加载中");
    });

    it("returns default result when dashboard.devices is undefined", () => {
      const result = calculateHealthScore({
        dashboard: { totalDurationMinutes: 0 } as LearningStatsDashboard,
        trend: [],
        topics: [],
        range: "week",
      });

      expect(result.score).toBe(0);
      expect(result.level).toBe("attention");
    });
  });

  describe("generateFallbackInsights", () => {
    it("generates at least one insight", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it("includes milestone insight for continuous days", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard({ continuousDays: 5 }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      const milestone = result.find((i) => i.type === "milestone");
      expect(milestone).toBeDefined();
      expect(milestone?.content).toContain("5");
    });

    it("includes alert when device is offline", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard({
          devices: [
            {
              ...dashboard().devices[0],
              status: "offline",
            },
          ],
        }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      const alert = result.find((i) => i.type === "alert");
      expect(alert).toBeDefined();
      expect(alert?.content).toContain("离线");
    });

    it("includes weakness insight when topics are unbalanced", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics([{ count: 20 }, { count: 2 }, { count: 1 }]),
        range: "week",
      });

      const weakness = result.find((i) => i.type === "weakness");
      expect(weakness).toBeDefined();
    });

    it("uses deviceName in device-level insights", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard({
          devices: [
            {
              ...dashboard().devices[0],
              todayDurationMinutes: 0,
            },
          ],
        }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });

      expect(result.some((i) => i.deviceName === "小明")).toBe(true);
    });

    it("handles undefined topics gracefully", () => {
      const result = generateFallbackInsights({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: undefined as any,
        range: "week",
      });

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("enrichDevicesWithStatus", () => {
    it("updates device status from real-time status map", () => {
      const devices = [dashboard().devices[0]];
      const statusMap: Record<string, any> = {
        d1: {
          deviceId: "d1",
          status: "online",
          battery: 80,
          isCharging: false,
          lastActiveAt: "2026-09-27T12:00:00Z",
        },
      };

      const result = enrichDevicesWithStatus(devices, statusMap);

      expect(result[0].status).toBe("online");
      expect(result[0].battery).toBe(80);
      expect(result[0].isCharging).toBe(false);
      expect(result[0].lastActiveAt).toBe("2026-09-27T12:00:00Z");
    });

    it("keeps original device when status is missing", () => {
      const devices = [dashboard().devices[0]];
      const result = enrichDevicesWithStatus(devices, {});
      expect(result[0].status).toBe(devices[0].status);
    });
  });

  describe("aggregateFamilyTrend", () => {
    it("returns daily points for week range", () => {
      const points = dailyPoints(7, 30);
      const result = aggregateFamilyTrend(points, "week");

      expect(result).toHaveLength(7);
      expect(result[0].label).toBe("9/1");
      expect(result[0].value).toBe(30);
    });

    it("aggregates weekly buckets for month range", () => {
      const points = dailyPoints(28, 30);
      const result = aggregateFamilyTrend(points, "month");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].label).toContain("-");
    });

    it("returns single point for today range", () => {
      const points = dailyPoints(1, 30);
      const result = aggregateFamilyTrend(points, "today");

      expect(result).toHaveLength(1);
    });

    it("returns empty array for empty input", () => {
      expect(aggregateFamilyTrend([], "week")).toEqual([]);
    });
  });
});
