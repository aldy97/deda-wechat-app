import {
  buildDisplayRecords,
  computeHasMore,
  withMinDelay,
  resolveHistoryFilters,
} from "./chat-history.utils";
import { ChatRecord, DeviceConfig } from "../../api/api";

describe("chat-history utils", () => {
  describe("computeHasMore", () => {
    // 后端 total 按 conversation 行计,pageSize 作用于行;
    // 前端 records 是拆条后的消息数,不能直接参与比较。
    it("returns true when fetched pages cover fewer rows than total", () => {
      expect(computeHasMore(1, 20, 36)).toBe(true);
    });

    it("returns false when fetched pages cover all rows", () => {
      expect(computeHasMore(2, 20, 36)).toBe(false);
    });

    it("returns false when total is an exact multiple of pageSize", () => {
      expect(computeHasMore(2, 20, 40)).toBe(false);
    });

    it("returns true when more rows remain beyond the first page", () => {
      expect(computeHasMore(1, 20, 21)).toBe(true);
    });

    it("returns false for a single partial page", () => {
      expect(computeHasMore(1, 20, 5)).toBe(false);
    });
  });

  describe("buildDisplayRecords", () => {
    const make = (id: string, createdAt: string): ChatRecord => ({
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

      const result = buildDisplayRecords(items);

      expect(result.map((r) => r.id)).toEqual(["1", "2", "3"]);
    });

    it("shows time on the first message and collapses messages within 5 minutes", () => {
      const items = [
        make("1", "2026-09-27T10:00:00.000Z"),
        make("2", "2026-09-27T10:02:00.000Z"),
        make("3", "2026-09-27T10:10:00.000Z"),
      ];

      const result = buildDisplayRecords(items);

      expect(result[0].displayTime).toBeTruthy();
      expect(result[1].displayTime).toBeUndefined();
      expect(result[2].displayTime).toBeTruthy();
    });

    it("returns empty array for empty input", () => {
      expect(buildDisplayRecords([])).toEqual([]);
    });
  });

  describe("resolveHistoryFilters", () => {
    const config = (over: Partial<DeviceConfig>): DeviceConfig =>
      ({
        deviceId: "dev-001",
        mode: "free_chat",
        ...over,
      }) as DeviceConfig;

    it("prefers explicit URL params over the device config", () => {
      const result = resolveHistoryFilters(
        { mode: "free_chat_qa" },
        config({ mode: "free_chat_casual" }),
      );
      expect(result).toEqual({ mode: "free_chat_qa" });
    });

    it("derives mode filter from config", () => {
      expect(
        resolveHistoryFilters({}, config({ mode: "free_chat_casual" })),
      ).toEqual({ mode: "free_chat_casual" });
    });

    it("returns mode filter when config is available", () => {
      expect(resolveHistoryFilters({}, config({}))).toEqual({ mode: "free_chat" });
    });

    it("returns empty filter when no config is available", () => {
      expect(resolveHistoryFilters({}, null)).toEqual({});
    });
  });

  describe("withMinDelay", () => {
    it("resolves with the task result but not before the minimum delay", async () => {
      const startedAt = Date.now();
      const result = await withMinDelay(Promise.resolve("ok"), 60);
      expect(result).toBe("ok");
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(59);
    });

    it("holds the minimum delay even when the task rejects", async () => {
      const startedAt = Date.now();
      await expect(
        withMinDelay(Promise.reject(new Error("boom")), 60),
      ).rejects.toThrow("boom");
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(59);
    });
  });
});
