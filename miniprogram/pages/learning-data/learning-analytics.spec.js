"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const learning_analytics_1 = require("./learning-analytics");
function dashboard(overrides = {}) {
  return Object.assign(
    {
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
    overrides,
  );
}
function dailyPoints(count, value) {
  return Array.from({ length: count }, (_, i) => ({
    date: `9/${i + 1}`,
    durationMinutes: value,
    sessionCount: 2,
  }));
}
function topics(list = []) {
  return list.map((t, i) =>
    Object.assign(
      {
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
      },
      t,
    ),
  );
}
describe("learning-analytics", () => {
  describe("getHealthLevel", () => {
    it("returns excellent for score >= 85", () => {
      expect((0, learning_analytics_1.getHealthLevel)(85)).toBe("excellent");
      expect((0, learning_analytics_1.getHealthLevel)(100)).toBe("excellent");
    });
    it("returns good for score 70-84", () => {
      expect((0, learning_analytics_1.getHealthLevel)(70)).toBe("good");
      expect((0, learning_analytics_1.getHealthLevel)(84)).toBe("good");
    });
    it("returns average for score 55-69", () => {
      expect((0, learning_analytics_1.getHealthLevel)(55)).toBe("average");
      expect((0, learning_analytics_1.getHealthLevel)(69)).toBe("average");
    });
    it("returns attention for score < 55", () => {
      expect((0, learning_analytics_1.getHealthLevel)(54)).toBe("attention");
      expect((0, learning_analytics_1.getHealthLevel)(0)).toBe("attention");
    });
  });
  describe("calculateHealthScore", () => {
    it("returns a score between 0 and 100", () => {
      const result = (0, learning_analytics_1.calculateHealthScore)({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
    it("includes all dimensions", () => {
      const result = (0, learning_analytics_1.calculateHealthScore)({
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
      const result = (0, learning_analytics_1.calculateHealthScore)({
        dashboard: dashboard({
          devices: [
            Object.assign(Object.assign({}, dashboard().devices[0]), {
              todayDurationMinutes: 0,
            }),
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
      const result = (0, learning_analytics_1.calculateHealthScore)({
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
  });
  describe("generateFallbackInsights", () => {
    it("generates at least one insight", () => {
      const result = (0, learning_analytics_1.generateFallbackInsights)({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });
      expect(result.length).toBeGreaterThan(0);
    });
    it("includes milestone insight for continuous days", () => {
      const result = (0, learning_analytics_1.generateFallbackInsights)({
        dashboard: dashboard({ continuousDays: 5 }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });
      const milestone = result.find((i) => i.type === "milestone");
      expect(milestone).toBeDefined();
      expect(
        milestone === null || milestone === void 0 ? void 0 : milestone.content,
      ).toContain("5");
    });
    it("includes alert when device is offline", () => {
      const result = (0, learning_analytics_1.generateFallbackInsights)({
        dashboard: dashboard({
          devices: [
            Object.assign(Object.assign({}, dashboard().devices[0]), {
              status: "offline",
            }),
          ],
        }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });
      const alert = result.find((i) => i.type === "alert");
      expect(alert).toBeDefined();
      expect(
        alert === null || alert === void 0 ? void 0 : alert.content,
      ).toContain("离线");
    });
    it("includes weakness insight when topics are unbalanced", () => {
      const result = (0, learning_analytics_1.generateFallbackInsights)({
        dashboard: dashboard(),
        trend: dailyPoints(7, 30),
        topics: topics([{ count: 20 }, { count: 2 }, { count: 1 }]),
        range: "week",
      });
      const weakness = result.find((i) => i.type === "weakness");
      expect(weakness).toBeDefined();
    });
    it("uses deviceName in device-level insights", () => {
      const result = (0, learning_analytics_1.generateFallbackInsights)({
        dashboard: dashboard({
          devices: [
            Object.assign(Object.assign({}, dashboard().devices[0]), {
              todayDurationMinutes: 0,
            }),
          ],
        }),
        trend: dailyPoints(7, 30),
        topics: topics(),
        range: "week",
      });
      expect(result.some((i) => i.deviceName === "小明")).toBe(true);
    });
  });
  describe("enrichDevicesWithStatus", () => {
    it("updates device status from real-time status map", () => {
      const devices = [dashboard().devices[0]];
      const statusMap = {
        d1: {
          deviceId: "d1",
          status: "online",
          battery: 80,
          isCharging: false,
          lastActiveAt: "2026-09-27T12:00:00Z",
        },
      };
      const result = (0, learning_analytics_1.enrichDevicesWithStatus)(
        devices,
        statusMap,
      );
      expect(result[0].status).toBe("online");
      expect(result[0].battery).toBe(80);
      expect(result[0].isCharging).toBe(false);
      expect(result[0].lastActiveAt).toBe("2026-09-27T12:00:00Z");
    });
    it("keeps original device when status is missing", () => {
      const devices = [dashboard().devices[0]];
      const result = (0, learning_analytics_1.enrichDevicesWithStatus)(
        devices,
        {},
      );
      expect(result[0].status).toBe(devices[0].status);
    });
  });
  describe("aggregateFamilyTrend", () => {
    it("returns daily points for week range", () => {
      const points = dailyPoints(7, 30);
      const result = (0, learning_analytics_1.aggregateFamilyTrend)(
        points,
        "week",
      );
      expect(result).toHaveLength(7);
      expect(result[0].label).toBe("9/1");
      expect(result[0].value).toBe(30);
    });
    it("aggregates weekly buckets for month range", () => {
      const points = dailyPoints(28, 30);
      const result = (0, learning_analytics_1.aggregateFamilyTrend)(
        points,
        "month",
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].label).toContain("-");
    });
    it("returns single point for today range", () => {
      const points = dailyPoints(1, 30);
      const result = (0, learning_analytics_1.aggregateFamilyTrend)(
        points,
        "today",
      );
      expect(result).toHaveLength(1);
    });
    it("returns empty array for empty input", () => {
      expect(
        (0, learning_analytics_1.aggregateFamilyTrend)([], "week"),
      ).toEqual([]);
    });
  });
});
