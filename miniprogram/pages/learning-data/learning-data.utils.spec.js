"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const learning_data_utils_1 = require("./learning-data.utils");
describe("learning-data utils", () => {
  describe("groupUnitProgressByTextbook", () => {
    it("groups units by textbook and preserves order", () => {
      const items = [
        {
          textbookId: "t1",
          textbookName: "Textbook 1",
          unitId: "u1",
          unitName: "Unit 1",
          conversationCount: 3,
          lastSpokeAt: "2026-09-25T00:00:00Z",
        },
        {
          textbookId: "t2",
          textbookName: "Textbook 2",
          unitId: "u2",
          unitName: "Unit 2",
          conversationCount: 1,
          lastSpokeAt: "2026-09-24T00:00:00Z",
        },
        {
          textbookId: "t1",
          textbookName: "Textbook 1",
          unitId: "u3",
          unitName: "Unit 3",
          conversationCount: 5,
          lastSpokeAt: "2026-09-23T00:00:00Z",
        },
      ];
      const result = (0, learning_data_utils_1.groupUnitProgressByTextbook)(
        items,
      );
      expect(result).toHaveLength(2);
      expect(result[0].textbookId).toBe("t1");
      expect(result[0].units).toHaveLength(2);
      expect(result[0].units[0].unitId).toBe("u1");
      expect(result[0].units[1].unitId).toBe("u3");
      expect(result[1].textbookId).toBe("t2");
      expect(result[1].units).toHaveLength(1);
    });
    it("returns empty array for empty input", () => {
      expect(
        (0, learning_data_utils_1.groupUnitProgressByTextbook)([]),
      ).toEqual([]);
    });
  });
  describe("formatTopicDisplayName", () => {
    it("prefers conversationModeName", () => {
      const topic = {
        id: "1",
        mode: "free_chat",
        conversationModeName: "自由闲聊",
        textbookName: "Textbook",
        unitName: "Unit 1",
        count: 1,
        lastSpokeAt: "",
        isActive: false,
      };
      expect((0, learning_data_utils_1.formatTopicDisplayName)(topic)).toBe(
        "自由闲聊 · Unit 1",
      );
    });
    it("falls back to textbookName then mode", () => {
      const topic = {
        id: "1",
        mode: "textbook_learning",
        textbookName: "Unlock L1",
        unitName: "Unit 2",
        count: 1,
        lastSpokeAt: "",
        isActive: false,
      };
      expect((0, learning_data_utils_1.formatTopicDisplayName)(topic)).toBe(
        "Unlock L1 · Unit 2",
      );
    });
    it("omits unitName when absent", () => {
      const topic = {
        id: "1",
        mode: "free_chat",
        conversationModeName: "自由闲聊",
        count: 1,
        lastSpokeAt: "",
        isActive: false,
      };
      expect((0, learning_data_utils_1.formatTopicDisplayName)(topic)).toBe(
        "自由闲聊",
      );
    });
  });
  describe("getRangeDays", () => {
    it("returns correct days", () => {
      expect((0, learning_data_utils_1.getRangeDays)("today")).toBe(1);
      expect((0, learning_data_utils_1.getRangeDays)("week")).toBe(7);
      expect((0, learning_data_utils_1.getRangeDays)("month")).toBe(30);
    });
  });
  describe("formatTopicScore", () => {
    it("returns score text when value exists", () => {
      expect((0, learning_data_utils_1.formatTopicScore)(85)).toBe("85分");
    });
    it("returns placeholder when value is null or undefined", () => {
      expect((0, learning_data_utils_1.formatTopicScore)(null)).toBe("--");
      expect((0, learning_data_utils_1.formatTopicScore)(undefined)).toBe("--");
    });
  });
  describe("getCalendarRangeDays", () => {
    it("today is always 1", () => {
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "today",
          new Date(2026, 8, 27),
        ),
      ).toBe(1);
    });
    it("week counts days since Monday (Sunday counts 7)", () => {
      // 2026-09-27 是周日
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "week",
          new Date(2026, 8, 27),
        ),
      ).toBe(7);
      // 2026-09-21 是周一
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "week",
          new Date(2026, 8, 21),
        ),
      ).toBe(1);
      // 2026-09-23 是周三
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "week",
          new Date(2026, 8, 23),
        ),
      ).toBe(3);
    });
    it("month counts days since the 1st", () => {
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "month",
          new Date(2026, 8, 1),
        ),
      ).toBe(1);
      expect(
        (0, learning_data_utils_1.getCalendarRangeDays)(
          "month",
          new Date(2026, 8, 27),
        ),
      ).toBe(27);
    });
  });
  describe("aggregateDailyToWeekly", () => {
    const point = (date, durationMinutes, sessionCount = 1) => ({
      date,
      durationMinutes,
      sessionCount,
    });
    it("buckets 30 days into 5 weekly groups with M/D-M/D labels", () => {
      // daily 端点返回顺序：从最早到最近
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(2026, 8, 27 - i); // 2026-08-29 .. 2026-09-27
        days.push(point(`${d.getMonth() + 1}/${d.getDate()}`, i % 3));
      }
      const result = (0, learning_data_utils_1.aggregateDailyToWeekly)(days);
      expect(result).toHaveLength(5);
      expect(result[0].label).toBe("8/29-9/4");
      expect(result[4].label).toBe("9/26-9/27");
      // 每桶聚合时长与轮数（bucket0 = i=29..23 → 2+1+0+2+1+0+2）
      expect(result[0].durationMinutes).toBe(8);
      expect(result[0].sessionCount).toBe(7);
    });
    it("keeps a short tail bucket as-is", () => {
      const days = [point("9/26", 5), point("9/27", 10)];
      const result = (0, learning_data_utils_1.aggregateDailyToWeekly)(days);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("9/26-9/27");
      expect(result[0].durationMinutes).toBe(15);
    });
    it("uses a single date label for a one-day bucket", () => {
      const result = (0, learning_data_utils_1.aggregateDailyToWeekly)([
        point("9/27", 3),
      ]);
      expect(result[0].label).toBe("9/27");
    });
    it("returns empty for empty input", () => {
      expect((0, learning_data_utils_1.aggregateDailyToWeekly)([])).toEqual([]);
    });
  });
  describe("buildContextOptions", () => {
    const topic = (over) =>
      Object.assign(
        {
          id: "k",
          mode: "locked_unit",
          textbookId: "book-a",
          textbookName: "Unlock L1",
          unitId: "unit-1",
          unitName: "Food",
          conversationModeKey: null,
          conversationModeName: null,
          count: 3,
          lastSpokeAt: "2026-09-27T00:00:00Z",
          isActive: false,
          avgScore: null,
        },
        over,
      );
    it("puts the active context first as the default option with empty params", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([
        topic({ isActive: true }),
        topic({ unitId: "unit-2", unitName: "Seasons" }),
      ]);
      expect(result[0].key).toBe("default");
      expect(result[0].params).toEqual({});
      expect(result[0].label).toContain("当前");
      expect(result[0].label).toContain("Food");
      expect(result).toHaveLength(3);
    });
    it("falls back to generic label when no topic is active", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([
        topic({}),
      ]);
      expect(result[0].label).toBe("当前语境");
    });
    it("builds textbook options with textbookId/unitId params", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([
        topic({}),
      ]);
      expect(result[1]).toEqual({
        key: "book-a|unit-1",
        label: "Unlock L1 · Food",
        params: { textbookId: "book-a", unitId: "unit-1" },
      });
    });
    it("builds free_chat options with mode and sub-mode params", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([
        topic({
          mode: "free_chat",
          textbookId: null,
          textbookName: null,
          unitId: null,
          unitName: null,
          conversationModeKey: "free_chat_roleplay",
          conversationModeName: "角色扮演",
        }),
      ]);
      expect(result[1]).toEqual({
        key: "free_chat|free_chat_roleplay",
        label: "自由对话 · 角色扮演",
        params: {
          mode: "free_chat",
          conversationModeKey: "free_chat_roleplay",
        },
      });
    });
    it("falls back to raw ids when names are missing", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([
        topic({ textbookName: null, unitName: null }),
      ]);
      expect(result[1].label).toBe("book-a · unit-1");
    });
    it("returns only the default option for empty topics", () => {
      const result = (0, learning_data_utils_1.buildContextOptions)([]);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("default");
    });
  });
  describe("scaleBarHeights", () => {
    it("scales relative to the max value with a floor for non-zero values", () => {
      const result = (0, learning_data_utils_1.scaleBarHeights)(
        [0, 30, 60],
        160,
        60,
      );
      expect(result[0]).toBe(4); // 零值地板高度
      expect(result[2]).toBe(160); // 最大值满高
      expect(result[1]).toBe(80); // 一半
    });
    it("caps values above the reference max at full height", () => {
      const result = (0, learning_data_utils_1.scaleBarHeights)([120], 160, 60);
      expect(result[0]).toBe(160);
    });
    it("returns floor height for all-zero input", () => {
      expect(
        (0, learning_data_utils_1.scaleBarHeights)([0, 0], 160, 60),
      ).toEqual([4, 4]);
    });
    it("returns empty for empty input", () => {
      expect((0, learning_data_utils_1.scaleBarHeights)([], 160, 60)).toEqual(
        [],
      );
    });
  });
});
