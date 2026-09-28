"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
const chat_history_utils_1 = require("./chat-history.utils");
describe("chat-history utils", () => {
  describe("computeHasMore", () => {
    // 后端 total 按 conversation 行计,pageSize 作用于行;
    // 前端 records 是拆条后的消息数,不能直接参与比较。
    it("returns true when fetched pages cover fewer rows than total", () => {
      expect((0, chat_history_utils_1.computeHasMore)(1, 20, 36)).toBe(true);
    });
    it("returns false when fetched pages cover all rows", () => {
      expect((0, chat_history_utils_1.computeHasMore)(2, 20, 36)).toBe(false);
    });
    it("returns false when total is an exact multiple of pageSize", () => {
      expect((0, chat_history_utils_1.computeHasMore)(2, 20, 40)).toBe(false);
    });
    it("returns true when more rows remain beyond the first page", () => {
      expect((0, chat_history_utils_1.computeHasMore)(1, 20, 21)).toBe(true);
    });
    it("returns false for a single partial page", () => {
      expect((0, chat_history_utils_1.computeHasMore)(1, 20, 5)).toBe(false);
    });
  });
  describe("buildDisplayRecords", () => {
    const make = (id, createdAt) => ({
      id,
      role: "user",
      content: `msg-${id}`,
      createdAt,
    });
    it("preserves the page-internal ascending order returned by the backend", () => {
      const items = [
        make("1", "2026-09-27T10:00:00.000Z"),
        make("2", "2026-09-27T10:10:00.000Z"),
        make("3", "2026-09-27T10:20:00.000Z"),
      ];
      const result = (0, chat_history_utils_1.buildDisplayRecords)(items);
      expect(result.map((r) => r.id)).toEqual(["1", "2", "3"]);
    });
    it("shows time on the first message and collapses messages within 5 minutes", () => {
      const items = [
        make("1", "2026-09-27T10:00:00.000Z"),
        make("2", "2026-09-27T10:02:00.000Z"),
        make("3", "2026-09-27T10:10:00.000Z"),
      ];
      const result = (0, chat_history_utils_1.buildDisplayRecords)(items);
      expect(result[0].displayTime).toBeTruthy();
      expect(result[1].displayTime).toBeUndefined();
      expect(result[2].displayTime).toBeTruthy();
    });
    it("returns empty array for empty input", () => {
      expect((0, chat_history_utils_1.buildDisplayRecords)([])).toEqual([]);
    });
  });
  describe("resolveHistoryFilters", () => {
    const config = (over) =>
      Object.assign(
        {
          deviceId: "dev-001",
          mode: "locked_unit",
          textbookId: "book-a",
          unitId: "unit-1",
          conversationModeKey: null,
        },
        over,
      );
    it("prefers explicit URL params over the device config", () => {
      const result = (0, chat_history_utils_1.resolveHistoryFilters)(
        { textbookId: "book-b", unitId: "unit-9" },
        config({}),
      );
      expect(result).toEqual({ textbookId: "book-b", unitId: "unit-9" });
    });
    it("derives textbook+unit filter from locked_unit config", () => {
      expect(
        (0, chat_history_utils_1.resolveHistoryFilters)({}, config({})),
      ).toEqual({
        textbookId: "book-a",
        unitId: "unit-1",
      });
    });
    it("derives textbook+unit filter from textbook_learning config", () => {
      expect(
        (0, chat_history_utils_1.resolveHistoryFilters)(
          {},
          config({ mode: "textbook_learning", unitId: null }),
        ),
      ).toEqual({ textbookId: "book-a" });
    });
    it("derives textbook-only filter from free_textbook config", () => {
      expect(
        (0, chat_history_utils_1.resolveHistoryFilters)(
          {},
          config({ mode: "free_textbook" }),
        ),
      ).toEqual({ textbookId: "book-a" });
    });
    it("derives conversationModeKey filter from free_chat config", () => {
      expect(
        (0, chat_history_utils_1.resolveHistoryFilters)(
          {},
          config({
            mode: "free_chat",
            textbookId: null,
            unitId: null,
            conversationModeKey: "free_chat_casual",
          }),
        ),
      ).toEqual({ conversationModeKey: "free_chat_casual" });
    });
    it("returns empty filter when no config is available", () => {
      expect((0, chat_history_utils_1.resolveHistoryFilters)({}, null)).toEqual(
        {},
      );
    });
  });
  describe("withMinDelay", () => {
    it("resolves with the task result but not before the minimum delay", () =>
      __awaiter(void 0, void 0, void 0, function* () {
        const startedAt = Date.now();
        const result = yield (0, chat_history_utils_1.withMinDelay)(
          Promise.resolve("ok"),
          60,
        );
        expect(result).toBe("ok");
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(59);
      }));
    it("holds the minimum delay even when the task rejects", () =>
      __awaiter(void 0, void 0, void 0, function* () {
        const startedAt = Date.now();
        yield expect(
          (0, chat_history_utils_1.withMinDelay)(
            Promise.reject(new Error("boom")),
            60,
          ),
        ).rejects.toThrow("boom");
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(59);
      }));
  });
});
