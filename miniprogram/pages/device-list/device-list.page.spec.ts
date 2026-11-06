/**
 * device-list 卡片模式展示测试（最小必要）。
 * 锁定 applyConfigToDevice 的三分支行为，删除教材模式后：
 * 未知 mode（含历史教材 key）必须走兜底分支而不炸。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getDeviceList: jest.fn(),
  bindDevice: jest.fn(),
  getDeviceStatus: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("device-list card display mapping", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./device-list");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
  });

  function applyConfig(config: Record<string, unknown>) {
    const device: Record<string, unknown> = { id: "dev-001" };
    page.applyConfigToDevice(device, { deviceId: "dev-001", ...config });
    return device;
  }

  it("free_chat 模式展示子模式名称与描述", () => {
    const device = applyConfig({
      mode: "free_chat",
      conversationModeKey: "free_chat_casual",
      conversationModeName: "自由闲聊",
      conversationModeDescription: "轻松闲聊。",
    });
    expect(device.cardTitle).toBe("自由闲聊");
    expect(device.cardDesc).toBe("轻松闲聊。");
  });

  it("历史教材模式 key 走兜底分支（教材功能已删除）", () => {
    const device = applyConfig({
      mode: "textbook_learning",
    });
    expect(device.cardTitle).toBe("textbook_learning");
    expect(device.cardSubtitle).toBe("");
    expect(device.cardDesc).toBe("DEDA AI 玩偶，随时在线陪伴孩子学习与成长。");
  });

  it("未知 mode 走兜底分支，展示原始 key 与默认文案", () => {
    const device = applyConfig({ mode: "some_future_mode" });
    expect(device.cardTitle).toBe("some_future_mode");
    expect(device.cardSubtitle).toBe("");
    expect(device.cardDesc).toBe("DEDA AI 玩偶，随时在线陪伴孩子学习与成长。");
  });
});
