/**
 * 绑定链路集成测试：只桩 wx.request，打穿 device-bind 页 → api.ts → request.ts。
 * 契约以 deda-server MINI_PROGRAM_API.md 3.1（POST /devices/bind）为准。
 */
import { installIntegrationHarness } from "./integration-harness";

const harness = installIntegrationHarness();

// harness 安装（wx 桩就绪）后再加载页面，页面经 api.ts → request.ts 落到 wx.request 桩
require("../pages/device-bind/device-bind");

describe("device-bind 绑定全链路（契约 3.1）", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    page.onLoad();
  });

  it("提交绑定：POST /devices/bind，body 仅含 trim 后的 deviceCode", async () => {
    harness.mockHttpSuccess(
      { success: true, deviceId: "dev-x", alreadyBound: false },
      201,
    );
    page.setData({ deviceCode: "  DEV001  " });

    await page.onBind();

    const req = harness.lastRequest();
    expect(req).toMatchObject({
      method: "POST",
      url: "http://127.0.0.1:3000/devices/bind",
      data: { deviceCode: "DEV001" },
    });
    expect(req?.header?.["Content-Type"]).toBe("application/json");
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "绑定成功" }),
    );
  });

  it("alreadyBound=true → toast「设备已绑定」", async () => {
    harness.mockHttpSuccess(
      { success: true, deviceId: "dev-x", alreadyBound: true },
      201,
    );
    page.setData({ deviceCode: "DEV001" });

    await page.onBind();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备已绑定" }),
    );
  });

  it("deviceCode 不存在（404）→ toast 透出后端 message，不返回上一页", async () => {
    harness.mockHttpError(404, { message: "设备编码不存在" });
    page.setData({ deviceCode: "NOPE" });

    await page.onBind();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备编码不存在" }),
    );
    expect(page.data.loading).toBe(false);
    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
  });

  it("401 → 全局清 token 并 reLaunch 到登录页", async () => {
    harness.mockHttpError(401, { message: "unauthorized" });
    page.setData({ deviceCode: "DEV001" });

    await page.onBind();

    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith("token");
    expect(harness.wx.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/login/login" }),
    );
  });

  it("绑定成功后 800ms 再返回上一页", async () => {
    jest.useFakeTimers();
    try {
      harness.mockHttpSuccess(
        { success: true, deviceId: "dev-x", alreadyBound: false },
        201,
      );
      page.setData({ deviceCode: "DEV001" });

      await page.onBind();
      expect(harness.wx.navigateBack).not.toHaveBeenCalled();

      jest.advanceTimersByTime(800);
      expect(harness.wx.navigateBack).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
