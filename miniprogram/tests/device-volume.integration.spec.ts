/**
 * 音量控制链路集成测试：只桩 wx.request，打穿 device-control 页 → api.ts → request.ts。
 * 契约以 deda-server MINI_PROGRAM_API.md 为准：
 * - 3.4 GET /devices/:id/status 回读设备真实 volume（可能为 null）
 * - 3.6 POST /devices/:id/control 仅 action=volume 真实下发；设备不存在 404
 */
import { installIntegrationHarness } from "./integration-harness";
import { API_BASE_URL } from "../config/api.config";

const harness = installIntegrationHarness();

require("../pages/device-control/device-control");

const ONLINE_STATUS = {
  deviceId: "dev-1",
  status: "online",
  battery: 65,
  volume: 80,
  isCharging: null,
  lastActiveAt: new Date().toISOString(),
};

describe("device-control 音量控制全链路（契约 3.4 / 3.6）", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // 页面 onReady 会拉 status + 当前配置，统一给成功信封
    harness.mockHttpSuccess(ONLINE_STATUS);
    page = harness.createInstance();
  });

  it("status 回读的音量作为初值：80 时步进器可用", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    expect(page.data.volume).toBe(80);
    expect(page.data.volumeUnknown).toBe(false);
    expect(page.data.minusDisabled).toBe(false);
    expect(page.data.plusDisabled).toBe(false);
  });

  it("点击加号：POST /devices/{id}/control，body 恰好 {action:'volume',volume}", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    await page.onVolumePlus();

    expect(harness.lastRequest()).toMatchObject({
      method: "POST",
      url: `${API_BASE_URL}/devices/dev-1/control`,
      data: { action: "volume", volume: 90 },
    });
    expect(page.data.lastCommittedVolume).toBe(90);
  });

  it("下发时设备 404 → toast「设备不存在或已解绑」并回滚音量", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();
    const before = page.data.volume;

    harness.mockHttpError(404, { message: "设备不存在" });
    await page.onVolumePlus();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "设备不存在或已解绑" }),
    );
    expect(page.data.volume).toBe(before);
  });

  it("401 → 全局清 token 并 reLaunch 到登录页", async () => {
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    harness.mockHttpError(401, { message: "unauthorized" });
    await page.onVolumeMinus();

    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith("token");
    expect(harness.wx.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/login/login" }),
    );
  });

  it("status 为 offline：步进器置灰并提示，点击不下发", async () => {
    harness.mockHttpSuccess({ ...ONLINE_STATUS, status: "offline" });
    const offlinePage = harness.createInstance();
    offlinePage.onLoad({ id: "dev-1" });
    await offlinePage.onReady();

    expect(offlinePage.data.controlDisabled).toBe(true);
    expect(offlinePage.data.minusDisabled).toBe(true);
    expect(offlinePage.data.plusDisabled).toBe(true);
    expect(offlinePage.data.statusHint).toBe("设备离线，无法调节音量");

    const callsBefore = harness.wx.request.mock.calls.length;
    await offlinePage.onVolumePlus();
    expect(harness.wx.request.mock.calls.length).toBe(callsBefore);
  });

  it("status 音量字段缺失：按钮禁用，点击不下发", async () => {
    harness.mockHttpSuccess({ ...ONLINE_STATUS, volume: null });
    page.onLoad({ id: "dev-1" });
    await page.onReady();

    expect(page.data.volumeUnknown).toBe(true);
    expect(page.data.minusDisabled).toBe(true);
    expect(page.data.plusDisabled).toBe(true);

    const callsBefore = harness.wx.request.mock.calls.length;
    await page.onVolumePlus();
    expect(harness.wx.request.mock.calls.length).toBe(callsBefore);
  });
});
