/**
 * chat-history 页面装配测试。
 * 设备卡「查看对话」只传 deviceId → 页面必须按设备当前配置
 * 推导语境过滤；已废弃的教材 URL 参数一律静默忽略。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getChatRecords: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("chat-history page wiring", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./chat-history");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    mockApi.getChatRecords.mockResolvedValue({ data: { items: [], total: 0 } });
  });

  it("ignores legacy textbook mode config and sends no textbook filter", async () => {
    // 历史缓存中可能存在教材模式配置；教材功能已删除,不得带出教材过滤参数
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "locked_unit",
        textbookId: "unlock-l1-speaking-listening",
        unitId: "unit-2",
        conversationModeKey: null,
      },
    });

    await page.onLoad({ id: "dev-001" });
    await page.onReady();

    const callArg = mockApi.getChatRecords.mock.calls[0][0];
    expect(callArg.deviceId).toBe("dev-001");
    expect(callArg.textbookId).toBeUndefined();
    expect(callArg.unitId).toBeUndefined();
  });

  it("prefers explicit URL conversationModeKey over the device config", async () => {
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "free_chat",
        conversationModeKey: "free_chat_casual",
      },
    });

    await page.onLoad({
      id: "dev-001",
      conversationModeKey: "free_chat_qa",
    });
    await page.onReady();

    expect(mockApi.getChatRecords).toHaveBeenCalledWith(
      expect.objectContaining({ conversationModeKey: "free_chat_qa" }),
    );
  });

  it("derives conversationModeKey filter for free_chat config", async () => {
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "free_chat",
        conversationModeKey: "free_chat_roleplay",
      },
    });

    await page.onLoad({ id: "dev-001" });
    await page.onReady();

    expect(mockApi.getChatRecords).toHaveBeenCalledWith(
      expect.objectContaining({ conversationModeKey: "free_chat_roleplay" }),
    );
  });

  it("loads older records when onLoadMore is triggered", async () => {
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "free_chat",
        conversationModeKey: "free_chat_qa",
      },
    });
    mockApi.getChatRecords
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "m2",
              role: "user",
              content: "hi",
              createdAt: "2026-09-27T10:00:00Z",
            },
          ],
          total: 25,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "m1",
              role: "device",
              content: "hello",
              createdAt: "2026-09-27T09:00:00Z",
            },
          ],
          total: 25,
        },
      });

    await page.onLoad({ id: "dev-001" });
    await page.onReady();
    expect(page.data.records.length).toBe(1);
    expect(page.data.hasMore).toBe(true);

    await page.onLoadMore();

    expect(mockApi.getChatRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, deviceId: "dev-001" }),
    );
    expect(page.data.records.length).toBe(2);
  });

  it("keeps the loading spinner visible for at least 400ms during pagination", async () => {
    jest.useFakeTimers();
    try {
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        data: {
          deviceId: "dev-001",
          mode: "free_chat",
          conversationModeKey: "free_chat_qa",
        },
      });
      mockApi.getChatRecords
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: "m2",
                role: "user",
                content: "hi",
                createdAt: "2026-09-27T10:00:00Z",
              },
            ],
            total: 25,
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: "m1",
                role: "device",
                content: "hello",
                createdAt: "2026-09-27T09:00:00Z",
              },
            ],
            total: 25,
          },
        });

      await page.onLoad({ id: "dev-001" });
      await page.onReady();
      expect(page.data.records.length).toBe(1);

      const pending = page.onLoadMore();
      // 接口即使立即返回，399ms 时记录仍不应合并、spinner 仍在
      await jest.advanceTimersByTimeAsync(399);
      expect(page.data.loading).toBe(true);
      expect(page.data.records.length).toBe(1);

      await jest.advanceTimersByTimeAsync(1);
      await pending;
      expect(page.data.records.length).toBe(2);
      expect(page.data.loading).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("ignores deprecated textbookId/unitId URL params and falls back to device config context", async () => {
    // 旧分享链接可能携带教材参数；教材功能已删除,必须静默忽略并按设备配置推导语境
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "free_chat",
        conversationModeKey: "free_chat_casual",
      },
    });

    await page.onLoad({
      id: "dev-001",
      textbookId: "book-a",
      unitId: "unit-1",
    });
    await page.onReady();

    const callArg = mockApi.getChatRecords.mock.calls[0][0];
    expect(callArg.conversationModeKey).toBe("free_chat_casual");
    expect(callArg.textbookId).toBeUndefined();
    expect(callArg.unitId).toBeUndefined();
  });
});
