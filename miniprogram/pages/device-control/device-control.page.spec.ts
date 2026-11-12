/**
 * device-control 音量控制页交互单元测试（mock api 层）。
 * 契约 3.4：GET /devices/:id/status 回读设备真实 volume；
 * 契约 3.6：POST /devices/:id/control 中仅 action=volume 真实下发。
 * 覆盖：onLoad 参数兜底、音量未知初值（不读本机缓存）、status 四态
 * （online/offline/404/异常 fail-open）、10 步长吸附（非整十先归整）、
 * 边界与未知态禁用、失败回滚、last-wins 串行补发、离线防御。
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
  volume: 80,
  isCharging: null,
  lastActiveAt: new Date().toISOString(),
};

const CONTROL_OK = {
  code: 0,
  message: "",
  data: { success: true, deviceId: "dev-1", action: "volume" },
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

  /**
   * 以指定音量/在线态装载页面，随后清空调用记录，
   * 让用例只断言交互本身产生的请求与 toast。
   */
  async function loadPage(volume: number | null = 80, status = "online") {
    mockStatusResolve({ ...ONLINE_STATUS, status, volume });
    page.onLoad({ id: "dev-1" });
    await page.onReady();
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockImplementation(() => "");
    mockApi.controlDeviceVolume.mockResolvedValue(CONTROL_OK);
  }

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

    it("初始音量未知：值为 null 且两侧按钮禁用", () => {
      page.onLoad({ id: "dev-1" });

      expect(page.data.volume).toBeNull();
      expect(page.data.volumeUnknown).toBe(true);
      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
    });

    it("忽略本机音量缓存：即使存在 device_volume_* 也不作为初始值", () => {
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === "device_volume_dev-1" ? 45 : "",
      );
      page.onLoad({ id: "dev-1" });

      expect(page.data.volume).toBeNull();
      expect(page.data.lastCommittedVolume).toBeNull();
    });
  });

  describe("status 四态与步进器可用性", () => {
    it("online 且设备上报音量：步进器可用、无提示、记录已提交值", async () => {
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(true);
      expect(page.data.controlDisabled).toBe(false);
      expect(page.data.volume).toBe(80);
      expect(page.data.volumeUnknown).toBe(false);
      expect(page.data.minusDisabled).toBe(false);
      expect(page.data.plusDisabled).toBe(false);
      expect(page.data.statusHint).toBe("");
      expect(page.data.lastCommittedVolume).toBe(80);
    });

    it("online 但设备未上报音量：两侧按钮禁用并提示刷新", async () => {
      mockStatusResolve({ ...ONLINE_STATUS, volume: null });
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.volumeUnknown).toBe(true);
      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
      expect(page.data.statusHint).toBe(
        "未获取到设备音量，请点击「刷新状态」重试",
      );
    });

    it("offline：步进器置灰并提示「设备离线，无法调节音量」", async () => {
      mockStatusResolve({ ...ONLINE_STATUS, status: "offline" });
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(false);
      expect(page.data.controlDisabled).toBe(true);
      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
      expect(page.data.statusHint).toBe("设备离线，无法调节音量");
    });

    it("status 404：步进器置灰并提示「设备不存在或已解绑」", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.statusNotFound).toBe(true);
      expect(page.data.controlDisabled).toBe(true);
      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
      expect(page.data.statusHint).toBe("设备不存在或已解绑");
    });

    it("status 网络异常：在线判定 fail-open，但音量未知仍禁用按钮", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(new Error("Network error"));
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.deviceOnline).toBe(true);
      expect(page.data.controlDisabled).toBe(false);
      expect(page.data.volumeUnknown).toBe(true);
      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
      expect(page.data.statusHint).toBe(
        "未获取到设备音量，请点击「刷新状态」重试",
      );
    });

    it("服务端音量非数字：按未知处理，不拿脏值下发", async () => {
      mockStatusResolve({ ...ONLINE_STATUS, volume: "80" });
      page.onLoad({ id: "dev-1" });
      await page.onReady();

      expect(page.data.volume).toBeNull();
      expect(page.data.volumeUnknown).toBe(true);
    });

    it("点击刷新状态：重新拉取 status 与当前配置", async () => {
      await loadPage(80);

      await page.onRefresh();

      expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);
      expect(mockApi.getDeviceCurrentConfig).toHaveBeenCalledWith("dev-1");
    });

    it("当前配置拉取失败：不阻塞音量控制", async () => {
      mockApi.getDeviceCurrentConfig.mockRejectedValue(new Error("boom"));
      await loadPage(80);

      expect(page.data.controlDisabled).toBe(false);
      expect(page.data.volume).toBe(80);
    });
  });

  describe("10 步长吸附", () => {
    it("整十 80：减号 → 70 并下发", async () => {
      await loadPage(80);

      await page.onVolumeMinus();

      expect(page.data.volume).toBe(70);
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledWith("dev-1", 70);
    });

    it("整十 80：加号 → 90 并下发", async () => {
      await loadPage(80);

      await page.onVolumePlus();

      expect(page.data.volume).toBe(90);
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledWith("dev-1", 90);
    });

    it("非整十 47：减号先归整到 40（floor 到十位）", async () => {
      await loadPage(47);

      await page.onVolumeMinus();

      expect(page.data.volume).toBe(40);
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledWith("dev-1", 40);
    });

    it("非整十 47：加号先归整到 50（ceil 到十位）", async () => {
      await loadPage(47);

      await page.onVolumePlus();

      expect(page.data.volume).toBe(50);
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledWith("dev-1", 50);
    });

    it("非整十 5：减号归整到 0，随后减号禁用", async () => {
      await loadPage(5);

      await page.onVolumeMinus();

      expect(page.data.volume).toBe(0);
      expect(page.data.minusDisabled).toBe(true);
    });

    it("非整十 95：加号归整到 100，随后加号禁用", async () => {
      await loadPage(95);

      await page.onVolumePlus();

      expect(page.data.volume).toBe(100);
      expect(page.data.plusDisabled).toBe(true);
    });
  });

  describe("禁用态防御", () => {
    it("已到下界 0：点击减号不下发", async () => {
      await loadPage(0);

      expect(page.data.minusDisabled).toBe(true);
      await page.onVolumeMinus();

      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
      expect(page.data.volume).toBe(0);
    });

    it("已到上界 100：点击加号不下发", async () => {
      await loadPage(100);

      expect(page.data.plusDisabled).toBe(true);
      await page.onVolumePlus();

      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
      expect(page.data.volume).toBe(100);
    });

    it("音量未知：两侧按钮禁用，点击不下发", async () => {
      await loadPage(null);

      expect(page.data.minusDisabled).toBe(true);
      expect(page.data.plusDisabled).toBe(true);
      await page.onVolumeMinus();
      await page.onVolumePlus();

      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
    });

    it("设备离线：controlDisabled 生效，程序化点击不下发", async () => {
      await loadPage(80, "offline");

      await page.onVolumePlus();

      expect(mockApi.controlDeviceVolume).not.toHaveBeenCalled();
    });
  });

  describe("提交行为", () => {
    it("下发成功：更新已提交值，且不再写本机音量缓存", async () => {
      await loadPage(80);

      await page.onVolumePlus();

      expect(page.data.lastCommittedVolume).toBe(90);
      expect(harness.wx.setStorageSync).not.toHaveBeenCalledWith(
        "device_volume_dev-1",
        90,
      );
    });

    it("下发失败（非 404）：回滚到上次成功值 + toast 透出 message", async () => {
      await loadPage(80);
      mockApi.controlDeviceVolume.mockRejectedValue(
        new Error("服务器开小差了"),
      );

      await page.onVolumePlus();

      expect(page.data.volume).toBe(80);
      expect(page.data.lastCommittedVolume).toBe(80);
      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "服务器开小差了" }),
      );
    });

    it("下发 404：toast「设备不存在或已解绑」+ 回滚", async () => {
      await loadPage(80);
      mockApi.controlDeviceVolume.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );

      await page.onVolumePlus();

      expect(page.data.volume).toBe(80);
      expect(harness.wx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "设备不存在或已解绑" }),
      );
    });

    it("连点两次：last-wins 串行补发，不并发不乱序", async () => {
      await loadPage(80);
      let resolveFirst: (v: unknown) => void = () => {};
      mockApi.controlDeviceVolume
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveFirst = resolve)),
        )
        .mockResolvedValue(CONTROL_OK);

      const first = page.onVolumePlus(); // 80 → 90
      const second = page.onVolumePlus(); // 90 → 100
      // 第一个请求未完成时，第二个不应发出
      expect(mockApi.controlDeviceVolume).toHaveBeenCalledTimes(1);

      resolveFirst(CONTROL_OK);
      await Promise.all([first, second]);

      expect(mockApi.controlDeviceVolume).toHaveBeenCalledTimes(2);
      expect(mockApi.controlDeviceVolume).toHaveBeenLastCalledWith(
        "dev-1",
        100,
      );
      expect(page.data.lastCommittedVolume).toBe(100);
    });
  });
});
