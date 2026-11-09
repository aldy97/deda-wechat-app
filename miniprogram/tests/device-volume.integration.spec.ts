/**
 * 音量控制链路集成测试：只桩 wx.request，打穿 device-control 页 → api.ts → request.ts。
 * 契约以 deda-server MINI_PROGRAM_API.md 3.6（POST /devices/:id/control）为准：
 * 仅 action=volume 真实下发；设备不存在 404。
 */
import { installIntegrationHarness } from "./integration-harness";

const harness = installIntegrationHarness();

require("../pages/device-control/device-control");

const ONLINE_STATUS = {
  deviceId: "dev-1",
  status: "online",
  battery: 65,
  isCharging: null,
  lastActiveAt: new Date().toISOString(),
};

describe("device-control 音量控制全链路（契约 3.6）", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // 页面 onReady 会拉 status + 当前配置，统一给成功信封
    harness.mockHttpSuccess(ONLINE_STATUS);
    page = harness.createInstance();
  });

  it("拖动结束：POST /devices/{id}/control，body 恰好 {action:'volume',volume}", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    await page.onVolumeDragEnd({ detail: 65 });

    expect(harness.lastRequest()).toMatchObject({
      method: "POST",
      url: "http://127.0.0.1:3000/devices/dev-1/control",
      data: { action: "volume", volume: 65 },
    });
    // 成功后写入本地音量缓存
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "device_volume_dev-1",
      65,
    );
  });

  it("下发时设备 404 → toast「设备不存在或已解绑」并回滚音量", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();
    const before = page.data.volume;

    harness.mockHttpError(404, { message: "设备不存在" });
    await page.onVolumeDragEnd({ detail: 80 });

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备不存在或已解绑" }),
    );
    expect(page.data.volume).toBe(before);
  });

  it("401 → 全局清 token 并 reLaunch 到登录页", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    harness.mockHttpError(401, { message: "unauthorized" });
    await page.onVolumeDragEnd({ detail: 50 });

    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith("token");
    expect(harness.wx.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/login/login" }),
    );
  });

  it("status 为 offline：滑块置灰并提示，拖动结束不下发", async () => {
    harness.mockHttpSuccess({ ...ONLINE_STATUS, status: "offline" });
    const offlinePage = harness.createInstance();
    offlinePage.onLoad({ id: "dev-1" });
    await offlinePage.onReady();

    expect(offlinePage.data.sliderDisabled).toBe(true);
    expect(offlinePage.data.statusHint).toBe(
      "设备离线，指令将在设备上线后生效",
    );

    const callsBefore = harness.wx.request.mock.calls.length;
    await offlinePage.onVolumeDragEnd({ detail: 30 });
    expect(harness.wx.request.mock.calls.length).toBe(callsBefore);
  });
});
