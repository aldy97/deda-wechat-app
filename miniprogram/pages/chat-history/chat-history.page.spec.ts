/**
 * chat-history 页面装配测试（跨单元泄漏回归锁）。
 * 复现路径：设备卡「查看对话」只传 deviceId → 页面必须按设备当前配置
 * 推导语境过滤,否则全单元消息混排。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getChatRecords: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  getTextbookDetail: jest.fn(),
  getTextbookUnits: jest.fn(),
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
    mockApi.getTextbookDetail.mockResolvedValue({ data: { name: "Book A" } });
    mockApi.getTextbookUnits.mockResolvedValue({ data: [] });
  });

  it("derives textbook+unit filter from device config when URL has no context params", async () => {
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

    // 回归锁：必须带 unit-2 过滤,否则 unit-3 的消息会混进来
    expect(mockApi.getChatRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "dev-001",
        textbookId: "unlock-l1-speaking-listening",
        unitId: "unit-2",
      }),
    );
  });

  it("prefers explicit URL context params over the device config", async () => {
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "locked_unit",
        textbookId: "book-a",
        unitId: "unit-1",
      },
    });

    await page.onLoad({
      id: "dev-001",
      textbookId: "book-b",
      unitId: "unit-9",
    });

    expect(mockApi.getChatRecords).toHaveBeenCalledWith(
      expect.objectContaining({ textbookId: "book-b", unitId: "unit-9" }),
    );
  });

  it("derives conversationModeKey filter for free_chat config", async () => {
    mockApi.getDeviceCurrentConfig.mockResolvedValue({
      data: {
        deviceId: "dev-001",
        mode: "free_chat",
        textbookId: null,
        unitId: null,
        conversationModeKey: "free_chat_roleplay",
      },
    });

    await page.onLoad({ id: "dev-001" });

    expect(mockApi.getChatRecords).toHaveBeenCalledWith(
      expect.objectContaining({ conversationModeKey: "free_chat_roleplay" }),
    );
    // 不应带教材过滤
    const callArg = mockApi.getChatRecords.mock.calls[0][0];
    expect(callArg.textbookId).toBeFalsy();
    expect(callArg.unitId).toBeFalsy();
  });
});
