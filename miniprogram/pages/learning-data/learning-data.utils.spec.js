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
});
