/**
 * owner-info 孩子信息页装配测试（page-harness）。
 * 锁定：
 * - from=bind（绑定成功后自动引导进入）：展示引导 banner 与「稍后再填」，
 *   保存/跳过后统一 switchTab 回设备列表；
 * - 常规进入（设备设置页）：行为不变，保存后 navigateBack。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getOwnerInfo: jest.fn(),
  updateOwnerInfo: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();
require("./owner-info");

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function createLoadedPage(options: Record<string, string>) {
  const page = harness.createInstance();
  mockApi.getOwnerInfo.mockResolvedValue({ code: 0, message: "", data: null });
  page.onLoad(options);
  return page;
}

describe("owner-info page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("常规进入（无 from 参数）：不展示绑定引导", async () => {
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    expect(page.data.deviceId).toBe("dev-001");
    expect(page.data.fromBind).toBe(false);
    expect(mockApi.getOwnerInfo).toHaveBeenCalledWith("dev-001");
  });

  it("from=bind 进入：展示绑定成功引导", async () => {
    const page = createLoadedPage({ id: "dev-002", from: "bind" });
    await page.onReady();
    await flushMicrotasks();

    expect(page.data.deviceId).toBe("dev-002");
    expect(page.data.fromBind).toBe(true);
  });

  it("from=bind 保存成功：switchTab 回设备列表，不 navigateBack", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-002", from: "bind" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({ "form.name": "熊熊" });
      mockApi.updateOwnerInfo.mockResolvedValue({
        code: 0,
        message: "",
        data: {},
      });
      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(mockApi.updateOwnerInfo).toHaveBeenCalledWith(
        "dev-002",
        expect.objectContaining({ name: "熊熊" }),
      );
      expect(harness.wx.switchTab).toHaveBeenCalledWith({
        url: "/pages/device-list/device-list",
      });
      expect(harness.wx.navigateBack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("from=bind 点击「稍后再填」：switchTab 回设备列表", async () => {
    const page = createLoadedPage({ id: "dev-002", from: "bind" });
    await page.onReady();
    await flushMicrotasks();

    page.onSkipBindGuide();

    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });

  it("常规进入保存成功：维持 navigateBack 行为", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-001" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({ "form.name": "熊熊" });
      mockApi.updateOwnerInfo.mockResolvedValue({
        code: 0,
        message: "",
        data: {},
      });
      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(harness.wx.navigateBack).toHaveBeenCalled();
      expect(harness.wx.switchTab).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
