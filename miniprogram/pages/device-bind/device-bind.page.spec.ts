/**
 * device-bind 绑定页交互单元测试（mock api 层）。
 * 覆盖：输入校验、防重复提交、alreadyBound、失败透传、dev-only 测试编码提示。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  bindDevice: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();

require("./device-bind");

describe("device-bind 绑定页交互", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    page.onLoad();
  });

  describe("dev-only 测试编码提示", () => {
    it("develop 环境显示提示", () => {
      expect(page.data.isDev).toBe(true);
    });

    it("release 环境隐藏提示", () => {
      harness.wx.getAccountInfoSync.mockReturnValue({
        miniProgram: { envVersion: "release" },
      });
      const releasePage = harness.createInstance();
      releasePage.onLoad();
      expect(releasePage.data.isDev).toBe(false);
      harness.wx.getAccountInfoSync.mockReturnValue({
        miniProgram: { envVersion: "develop" },
      });
    });
  });

  it("空输入 / 纯空格：toast 提示且不发请求", async () => {
    page.setData({ deviceCode: "   " });
    await page.onBind();

    expect(mockApi.bindDevice).not.toHaveBeenCalled();
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "请输入设备编码" }),
    );
    expect(page.data.loading).toBe(false);
  });

  it("输入去空格后提交；成功 toast + 清列表缓存 + 800ms 后返回", async () => {
    jest.useFakeTimers();
    try {
      mockApi.bindDevice.mockResolvedValue({
        code: 0,
        message: "",
        data: { success: true, deviceId: "dev-x", alreadyBound: false },
      });
      page.setData({ deviceCode: " DEV001 " });

      await page.onBind();

      expect(mockApi.bindDevice).toHaveBeenCalledWith({
        deviceCode: "DEV001",
      });
      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "绑定成功" }),
      );
      expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
        "device_list_cache",
      );
      expect(harness.wx.navigateBack).not.toHaveBeenCalled();
      jest.advanceTimersByTime(800);
      expect(harness.wx.navigateBack).toHaveBeenCalled();
      expect(page.data.loading).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("alreadyBound=true → toast「设备已绑定」", async () => {
    mockApi.bindDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: { success: true, deviceId: "dev-x", alreadyBound: true },
    });
    page.setData({ deviceCode: "DEV001" });

    await page.onBind();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备已绑定" }),
    );
  });

  it("绑定中重复提交被拦截：api 只调一次", async () => {
    let resolveBind: (v: unknown) => void = () => {};
    mockApi.bindDevice.mockImplementation(
      () => new Promise((resolve) => (resolveBind = resolve)),
    );
    page.setData({ deviceCode: "DEV001" });

    const first = page.onBind();
    const second = page.onBind();
    resolveBind({
      code: 0,
      message: "",
      data: { success: true, deviceId: "dev-x", alreadyBound: false },
    });
    await Promise.all([first, second]);

    expect(mockApi.bindDevice).toHaveBeenCalledTimes(1);
  });

  it("绑定失败：toast 透出后端 message，loading 复位", async () => {
    mockApi.bindDevice.mockRejectedValue(new Error("设备编码不存在"));
    page.setData({ deviceCode: "NOPE" });

    await page.onBind();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备编码不存在" }),
    );
    expect(page.data.loading).toBe(false);
    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
  });
});
