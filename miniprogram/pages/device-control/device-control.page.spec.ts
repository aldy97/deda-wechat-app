/**
 * device-control 音量控制页交互单元测试（mock api 层）。
 * 契约 3.6：仅 action=volume 真实下发。覆盖：
 * onLoad 参数兜底、初始音量缓存、status 三态（online/offline/404/异常 fail-open）、
 * 拖动不提交/松手提交、失败回滚、last-wins 串行补发、离线防御。
 * formatModeDisplay 的 3 条分支锁定保留。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  controlDeviceVolume: jest.fn(),
  getDeviceStatus: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();

require("./device-control");

const ONLINE_STATUS = {
  deviceId: "dev-1",
  status: "online",
  battery: 65,
  isCharging: null,
  lastActiveAt: new Date().toISOString(),
};

function mockStatusResolve(data: Record<string, unknown>) {
  mockApi.getDeviceStatus.mockResolvedValue({ code: 0, message: "", data });
}
function mockConfigResolve() {
  mockApi.ensureAuthToken.mockResolvedValue(undefined);
  mockApi.getDeviceCurrentConfig.mockResolvedValue({
    code: 0,
    message: "",
    data: null,
  });
}

describe("device-control mode display", () => {
  let page: any;

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

describe("device-control 音量控制交互", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks 不清除 mockImplementation，显式复位 storage 桩防串扰
    harness.wx.getStorageSync.mockImplementation(() => "");
    mockConfigResolve();
    mockStatusResolve(ONLINE_STATUS);
    page = harness.createInstance();
  });

  describe("onLoad 参数与初始音量", () => {
    it("缺少 id：toast 提示并返回，不发任何请求", async () => {
      page.onLoad({});
      await page.onReady();

      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "缺少设备参数" }),
      );
      expect(harness.wx.navigateBack).toHaveBeenCalled();
      expect(mockApi.getDeviceStatus).not.toHaveBeenCalled();
      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
    });

    it("有本地缓存音量时初始化为缓存值", () => {
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === "device_volume_dev-1" ? 45 : "",
      );
      page.onLoad({ id: "dev-1" });

      expect(page.data.volume).toBe(45);
      expect(page.data.lastCommittedVolume).toBe(45);
    });

    it("无缓存时默认 60", () => {
      page.onLoad({ id: "dev-1" });
      expect(page.data.volume).toBe(60);
    });
  });

  describe("status 三态与滑块可用性", () => {
    it("online：滑块可用，无提示", async () => {
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(true);
      expect(page.data.sliderDisabled).toBe(false);
      expect(page.data.statusHint).toBe("");
    });

    it("offline：滑块置灰并提示「设备离线，指令将在设备上线后生效」", async () => {
      mockStatusResolve({ ...ONLINE_STATUS, status: "offline" });
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(false);
      expect(page.data.sliderDisabled).toBe(true);
      expect(page.data.statusHint).toBe("设备离线，指令将在设备上线后生效");
    });

    it("status 404：滑块置灰并提示「设备不存在或已解绑」", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.statusNotFound).toBe(true);
      expect(page.data.sliderDisabled).toBe(true);
      expect(page.data.statusHint).toBe("设备不存在或已解绑");
    });

    it("status 网络异常：fail-open 不阻塞控制、无提示", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(new Error("Network error"));
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(true);
      expect(page.data.sliderDisabled).toBe(false);
      expect(page.data.statusHint).toBe("");
    });
  });

  describe("提交行为", () => {
    beforeEach(async () => {
      page.onLoad({ id: "dev-1" });
      await page.onReady();
      jest.clearAllMocks();
    });

    it("拖动中（change）只改本地，不发请求", () => {
      page.onVolumeChange({ detail: 70 });

      expect(page.data.volume).toBe(70);
      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
    });

    it("拖动结束提交：成功后写缓存并更新已提交值", async () => {
      mockApi.controlDeviceVolume.mockResolvedValue({
        code: 0,
        message: "",
        data: { success: true, deviceId: "dev-1", action: "volume" },
      });

      await page.onVolumeDragEnd({ detail: 65 });

      expect(mockApi.controlDeviceVolume).toHaveBeenCalledWith("dev-1", 65);
      expect(page.data.volume).toBe(65);
      expect(page.data.lastCommittedVolume).toBe(65);
      expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
        "device_volume_dev-1",
        65,
      );
    });

    it("提交失败（非 404）：回滚到上次成功值 + toast 透出 message", async () => {
      mockApi.controlDeviceVolume.mockRejectedValue(
        new Error("服务器开小差了"),
      );

      await page.onVolumeDragEnd({ detail: 90 });

      expect(page.data.volume).toBe(60);
      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "服务器开小差了" }),
      );
    });

    it("提交 404：toast「设备不存在或已解绑」+ 回滚", async () => {
      mockApi.controlDeviceVolume.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );

      await page.onVolumeDragEnd({ detail: 90 });

      expect(page.data.volume).toBe(60);
      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "设备不存在或已解绑" }),
      );
    });

    it("提交中再次松手：last-wins 串行补发，不并发不乱序", async () => {
      let resolveFirst: (v: unknown) => void = () => {};
      mockApi.controlDeviceVolume
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveFirst = resolve)),
        )
        .mockResolvedValue({
          code: 0,
          message: "",
          data: { success: true, deviceId: "dev-1", action: "volume" },
        });

      const first = page.onVolumeDragEnd({ detail: 30 });
      const second = page.onVolumeDragEnd({ detail: 80 });
      // 第一个请求未完成时，第二个不应发出
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledTimes(1);

      resolveFirst({
        code: 0,
        message: "",
        data: { success: true, deviceId: "dev-1", action: "volume" },
      });
      await Promise.all([first, second]);

      expect(mockApi.controlDeviceVolume).toHaveBeenCalledTimes(2);
      expect(mockApi.controlDeviceVolume).toHaveBeenLastCalledWith("dev-1", 80);
      expect(page.data.lastCommittedVolume).toBe(80);
    });

    it("滑块置灰（离线）时拖动结束不下发（防御）", async () => {
      page.applyStatusState({ loaded: true, notFound: false, online: false });

      await page.onVolumeDragEnd({ detail: 30 });

      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
    });
  });
});
