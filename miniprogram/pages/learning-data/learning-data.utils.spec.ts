import {
  getRangeDays,
  getCalendarRangeDays,
  formatTopicScore,
  aggregateDailyToWeekly,
  scaleBarHeights,
  groupTimelineByDayAndDevice,
  allocateIntegerPercentages,
} from "./learning-data.utils";
import {
  LearningStatsDailyPoint,
  LearningStatsTimelineEvent,
} from "../../api/api";

describe("learning-data utils", () => {
  describe("allocateIntegerPercentages", () => {
    it("uses largest remainders and keeps the displayed total at 100", () => {
      expect(allocateIntegerPercentages([2, 2, 2, 1])).toEqual([
        29, 29, 28, 14,
      ]);
    });

    it("uses the original order to break equal-remainder ties", () => {
      expect(allocateIntegerPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    });

    it("returns zero percentages when there is no activity", () => {
      expect(allocateIntegerPercentages([])).toEqual([]);
      expect(allocateIntegerPercentages([0, 0, 0])).toEqual([0, 0, 0]);
    });

    it("keeps the total at 100 for every small non-negative count combination", () => {
      for (let length = 1; length <= 5; length += 1) {
        const combinationCount = 6 ** length;
        for (let encoded = 0; encoded < combinationCount; encoded += 1) {
          let value = encoded;
          const counts = Array.from({ length }, () => {
            const count = value % 6;
            value = Math.floor(value / 6);
            return count;
          });
          const percentages = allocateIntegerPercentages(counts);
          const total = counts.reduce((sum, count) => sum + count, 0);
          const expectedTotal = total > 0 ? 100 : 0;

          expect(percentages.reduce((sum, percent) => sum + percent, 0)).toBe(
            expectedTotal,
          );
          expect(
            percentages.every(
              (percent) =>
                Number.isInteger(percent) && percent >= 0 && percent <= 100,
            ),
          ).toBe(true);
        }
      }
    });

    it("keeps the total at 100 for varied larger count combinations", () => {
      let seed = 20261101;
      const nextRandom = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed;
      };

      for (let caseIndex = 0; caseIndex < 500; caseIndex += 1) {
        const length = 1 + (nextRandom() % 12);
        const counts = Array.from({ length }, () => nextRandom() % 100000);
        if (!counts.some((count) => count > 0)) counts[0] = 1;
        const percentages = allocateIntegerPercentages(counts);

        expect(percentages.reduce((sum, percent) => sum + percent, 0)).toBe(
          100,
        );
      }
    });
  });

  describe("getRangeDays", () => {
    it("returns correct days", () => {
      expect(getRangeDays("today")).toBe(1);
      expect(getRangeDays("week")).toBe(7);
      expect(getRangeDays("month")).toBe(30);
    });
  });

  describe("formatTopicScore", () => {
    it("returns score text when value exists", () => {
      expect(formatTopicScore(85)).toBe("85分");
    });

    it("returns placeholder when value is null or undefined", () => {
      expect(formatTopicScore(null)).toBe("--");
      expect(formatTopicScore(undefined)).toBe("--");
    });
  });

  describe("getCalendarRangeDays", () => {
    it("today is always 1", () => {
      expect(getCalendarRangeDays("today", new Date(2026, 8, 27))).toBe(1);
    });

    it("week counts days since Monday (Sunday counts 7)", () => {
      // 2026-09-27 是周日
      expect(getCalendarRangeDays("week", new Date(2026, 8, 27))).toBe(7);
      // 2026-09-21 是周一
      expect(getCalendarRangeDays("week", new Date(2026, 8, 21))).toBe(1);
      // 2026-09-23 是周三
      expect(getCalendarRangeDays("week", new Date(2026, 8, 23))).toBe(3);
    });

    it("month counts days since the 1st", () => {
      expect(getCalendarRangeDays("month", new Date(2026, 8, 1))).toBe(1);
      expect(getCalendarRangeDays("month", new Date(2026, 8, 27))).toBe(27);
    });
  });

  describe("aggregateDailyToWeekly", () => {
    const point = (
      date: string,
      durationMinutes: number,
      sessionCount = 1,
    ): LearningStatsDailyPoint => ({
      date,
      durationMinutes,
      sessionCount,
    });

    it("buckets 30 days into 5 weekly groups with M/D-M/D labels", () => {
      // daily 端点返回顺序：从最早到最近
      const days: LearningStatsDailyPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(2026, 8, 27 - i); // 2026-08-29 .. 2026-09-27
        days.push(point(`${d.getMonth() + 1}/${d.getDate()}`, i % 3));
      }

      const result = aggregateDailyToWeekly(days);

      expect(result).toHaveLength(5);
      expect(result[0].label).toBe("8/29-9/4");
      expect(result[4].label).toBe("9/26-9/27");
      // 每桶聚合时长与轮数（bucket0 = i=29..23 → 2+1+0+2+1+0+2）
      expect(result[0].durationMinutes).toBe(8);
      expect(result[0].sessionCount).toBe(7);
    });

    it("keeps a short tail bucket as-is", () => {
      const days = [point("9/26", 5), point("9/27", 10)];

      const result = aggregateDailyToWeekly(days);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("9/26-9/27");
      expect(result[0].durationMinutes).toBe(15);
    });

    it("uses a single date label for a one-day bucket", () => {
      const result = aggregateDailyToWeekly([point("9/27", 3)]);

      expect(result[0].label).toBe("9/27");
    });

    it("returns empty for empty input", () => {
      expect(aggregateDailyToWeekly([])).toEqual([]);
    });
  });

  describe("scaleBarHeights", () => {
    it("scales relative to the max value with a floor for non-zero values", () => {
      const result = scaleBarHeights([0, 30, 60], 160, 60);

      expect(result[0]).toBe(4); // 零值地板高度
      expect(result[2]).toBe(160); // 最大值满高
      expect(result[1]).toBe(80); // 一半
    });

    it("caps values above the reference max at full height", () => {
      const result = scaleBarHeights([120], 160, 60);
      expect(result[0]).toBe(160);
    });

    it("returns floor height for all-zero input", () => {
      expect(scaleBarHeights([0, 0], 160, 60)).toEqual([4, 4]);
    });

    it("returns empty for empty input", () => {
      expect(scaleBarHeights([], 160, 60)).toEqual([]);
    });
  });

  describe("groupTimelineByDayAndDevice", () => {
    const event = (
      id: string,
      deviceId: string,
      deviceName: string,
      createdAt: string,
    ): LearningStatsTimelineEvent => ({
      id,
      deviceId,
      deviceName,
      mode: "free_chat",
      topicName: "Food",
      userText: "Hello",
      aiText: "Hi",
      createdAt,
    });

    it("returns empty array for empty input", () => {
      expect(groupTimelineByDayAndDevice([])).toEqual([]);
    });

    it("groups events by date and device", () => {
      const items = [
        event("e1", "d1", "Device A", "2026-09-28T10:00:00Z"),
        event("e2", "d1", "Device A", "2026-09-28T11:00:00Z"),
        event("e3", "d2", "Device B", "2026-09-28T12:00:00Z"),
        event("e4", "d1", "Device A", "2026-09-27T10:00:00Z"),
      ];

      const result = groupTimelineByDayAndDevice(items);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2026-09-28");
      expect(result[0].devices).toHaveLength(2);
      expect(result[0].devices[0].events).toHaveLength(2);
      expect(result[1].date).toBe("2026-09-27");
      expect(result[1].devices).toHaveLength(1);
    });

    it("sorts days in descending order", () => {
      const items = [
        event("e1", "d1", "Device A", "2026-09-25T10:00:00Z"),
        event("e2", "d1", "Device A", "2026-09-27T10:00:00Z"),
        event("e3", "d1", "Device A", "2026-09-26T10:00:00Z"),
      ];

      const result = groupTimelineByDayAndDevice(items);

      expect(result.map((d) => d.date)).toEqual([
        "2026-09-27",
        "2026-09-26",
        "2026-09-25",
      ]);
    });

    it("sets expanded true by default", () => {
      const items = [event("e1", "d1", "Device A", "2026-09-28T10:00:00Z")];
      const result = groupTimelineByDayAndDevice(items);
      expect(result[0].devices[0].expanded).toBe(true);
    });
  });
});
