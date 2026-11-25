/**
 * device-setting 删除设备交互单元测试（mock api 层）。
 * 覆盖：onLoad 参数解析、确认弹窗开关、防重复删除、
 * 404 幂等当成功（契约 3.9）、失败保留弹窗、返回路径兜底。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  deleteDevice: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();

require("./device-setting");

const getCurrentPagesMock = () =>
  (globalThis as any).getCurrentPages as jest.Mock;

describe("device-setting 删除设备交互", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    // 默认页面栈两层：navigateBack 可用
    getCurrentPagesMock().mockReturnValue([{}, {}]);
    page.onLoad({ id: "dev-1" });
  });

  it("onLoad 解析 id；缺省为空串", () => {
    expect(page.data.deviceId).toBe("dev-1");
    const bare = harness.createInstance();
    bare.onLoad(undefined);
    expect(bare.data.deviceId).toBe("");
  });

  it("设备设置页展示音量控制 item：点击跳转音量控制页", () => {
    page.onVolumeSetting();
    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/device-control/device-control?id=dev-1",
    });
  });

  it("缺少 deviceId：点击音量控制不跳转", () => {
    const bare = harness.createInstance();
    bare.onLoad(undefined);

    bare.onVolumeSetting();

    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
  });

  it("点删除开弹窗；取消关弹窗且不发请求", async () => {
    page.onDeleteDevice();
    expect(page.data.showDeleteModal).toBe(true);

    page.onCancelDelete();
    expect(page.data.showDeleteModal).toBe(false);
    expect(mockApi.deleteDevice).not.toHaveBeenCalled();
  });

  it("确认删除成功：带正确 id、toast、清缓存、navigateBack", async () => {
    mockApi.deleteDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: { success: true, deviceId: "dev-1" },
    });
    page.onDeleteDevice();

    await page.onConfirmDelete();

    expect(mockApi.deleteDevice).toHaveBeenCalledWith("dev-1");
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "删除成功" }),
    );
    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
      "device_list_cache",
    );
    expect(harness.wx.navigateBack).toHaveBeenCalled();
    expect(page.data.showDeleteModal).toBe(false);
  });

  it("删除中重复确认被拦截：api 只调一次", async () => {
    let resolveDelete: (v: unknown) => void = () => {};
    mockApi.deleteDevice.mockImplementation(
      () => new Promise((resolve) => (resolveDelete = resolve)),
    );
    page.onDeleteDevice();

    const first = page.onConfirmDelete();
    const second = page.onConfirmDelete();
    resolveDelete({
      code: 0,
      message: "",
      data: { success: true, deviceId: "dev-1" },
    });
    await Promise.all([first, second]);

    expect(mockApi.deleteDevice).toHaveBeenCalledTimes(1);
  });

  it("解绑 404（绑定关系已不存在）→ 幂等当成功", async () => {
    mockApi.deleteDevice.mockRejectedValue(
      Object.assign(new Error("设备不存在"), { statusCode: 404 }),
    );
    page.onDeleteDevice();

    await page.onConfirmDelete();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "删除成功" }),
    );
    expect(harness.wx.navigateBack).toHaveBeenCalled();
  });

  it("非 404 失败：toast 透出 message、弹窗保持、loading 复位", async () => {
    mockApi.deleteDevice.mockRejectedValue(
      Object.assign(new Error("服务器开小差了"), { statusCode: 500 }),
    );
    page.onDeleteDevice();

    await page.onConfirmDelete();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "服务器开小差了" }),
    );
    expect(page.data.showDeleteModal).toBe(true);
    expect(page.data.deleteLoading).toBe(false);
    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
  });

  it("页面栈仅一层时：删除成功后 switchTab 回设备列表", async () => {
    getCurrentPagesMock().mockReturnValue([{}]);
    mockApi.deleteDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: { success: true, deviceId: "dev-1" },
    });
    page.onDeleteDevice();

    await page.onConfirmDelete();

    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });
});
