/**
 * switch-mode 页面装配测试（mode-only 400 回归锁）。
 * 契约：点分类只做导航,不预先保存配置;
 * 完整载荷由子选择页提交（后端对 mode-only 载荷返回 400）。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getConversationModeCategories: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  switchDeviceMode: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("switch-mode page wiring", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./switch-mode");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    page.data.deviceId = "dev-001";
  });

  it("navigates to sub-mode picker on free_chat without saving config", () => {
    page.onSelectMode({ currentTarget: { dataset: { key: "free_chat" } } });

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/choose-free-chat-mode/choose-free-chat-mode?id=dev-001",
    });
    // 回归锁：分类点击不得触发 mode-only 保存
    expect(mockApi.switchDeviceMode).not.toHaveBeenCalled();
  });

  it("navigates to textbook learning on textbook_learning without saving config", () => {
    page.onSelectMode({
      currentTarget: { dataset: { key: "textbook_learning" } },
    });

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/textbook-learning/textbook-learning?id=dev-001",
    });
    expect(mockApi.switchDeviceMode).not.toHaveBeenCalled();
  });

  it("shows a toast and does not navigate for unknown mode keys", () => {
    page.onSelectMode({ currentTarget: { dataset: { key: "locked_unit" } } });

    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
    expect(harness.wx.showToast).toHaveBeenCalled();
    expect(mockApi.switchDeviceMode).not.toHaveBeenCalled();
  });
});
