/**
 * 解绑链路集成测试：只桩 wx.request，打穿 device-setting 页 → api.ts → request.ts。
 * 契约以 deda-server MINI_PROGRAM_API.md 3.9（DELETE /devices/:id）为准。
 */
import { installIntegrationHarness } from "./integration-harness";

const harness = installIntegrationHarness();

require("../pages/device-setting/device-setting");

describe("device-setting 解绑全链路（契约 3.9）", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // 页面栈两层：navigateBack 可用
    (globalThis as any).getCurrentPages.mockReturnValue([{}, {}]);
    page = harness.createInstance();
    page.onLoad({ id: "dev-1" });
    page.onDeleteDevice();
  });

  it("确认删除：DELETE /devices/{id}，成功后 toast + 返回列表", async () => {
    harness.mockHttpSuccess({ success: true, deviceId: "dev-1" });

    await page.onConfirmDelete();

    expect(harness.lastRequest()).toMatchObject({
      method: "DELETE",
      url: "http://127.0.0.1:3000/devices/dev-1",
    });
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "删除成功" }),
    );
    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
      "device_list_cache",
    );
    expect(harness.wx.navigateBack).toHaveBeenCalled();
  });

  it("解绑 404（绑定关系已不存在）→ 幂等当成功，不弹错误", async () => {
    harness.mockHttpError(404, { message: "设备不存在" });

    await page.onConfirmDelete();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "删除成功" }),
    );
    expect(harness.wx.navigateBack).toHaveBeenCalled();
  });

  it("网络失败 → 弹窗保持、loading 复位、不返回", async () => {
    harness.mockNetworkFail();

    await page.onConfirmDelete();

    expect(page.data.showDeleteModal).toBe(true);
    expect(page.data.deleteLoading).toBe(false);
    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "none" }),
    );
  });
});
