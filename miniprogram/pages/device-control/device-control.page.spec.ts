/**
 * device-control 模式展示文案测试（最小必要）。
 * 锁定 formatModeDisplay 的分支行为，删除教材模式后：
 * 未知 mode（含历史教材 key）必须回退为原始 key 而不炸。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getDeviceControl: jest.fn(),
  updateDeviceControl: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("device-control mode display", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./device-control");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
  });

  function format(config: Record<string, unknown>): string {
    return page.formatModeDisplay({ deviceId: "dev-001", ...config });
  }

  it("free_chat 模式展示 模式名 / 子模式 key", () => {
    expect(
      format({ mode: "free_chat", conversationModeKey: "free_chat_casual" }),
    ).toBe("自由对话 / free_chat_casual");
  });

  it("历史教材模式 key 回退为原始 key（教材功能已删除）", () => {
    expect(format({ mode: "textbook_learning" })).toBe("textbook_learning");
  });

  it("未知 mode 回退为原始 key", () => {
    expect(format({ mode: "some_future_mode" })).toBe("some_future_mode");
  });
});
