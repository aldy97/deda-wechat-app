/**
 * device-control 音量控制页交互单元测试（mock api 层）。
 * 契约 3.4：GET /devices/:id/status 回读设备真实 volume；
 * 契约 3.6：POST /devices/:id/control 中仅 action=volume 真实下发。
 * 覆盖：onLoad 参数兜底、音量未知初值（不读本机缓存）、status 四态
 * （online/offline/404/异常 fail-open）、10 步长吸附（非整十先归整）、
 * 边界与未知态禁用、失败回滚、last-wins 串行补发、离线防御；
 * 以及 10s 前台轮询（上线自动解锁、轮询失败不回退、生命周期停表）。
 * 2026-11-26 起页面不再展示对话模式，模式相关用例已移除。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  controlDeviceVolume: jest.fn(),
  getDeviceStatus: jest.fn(),
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

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("device-control 音量控制交互", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks 不清除 mockImplementation，显式复位 storage 桩防串扰
    harness.wx.getStorageSync.mockImplementation(() => "");
    mockStatusResolve(ONLINE_STATUS);
    page = harness.createInstance();
  });

  afterEach(() => {
    page.onUnload();
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
      expect(page.data.deviceStatusText).toBe("设备在线");
      expect(page.data.deviceStatusTone).toBe("online");
      expect(
        page.data.volumeDots.filter((dot: { on: boolean }) => dot.on),
      ).toHaveLength(8);
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
      expect(page.data.deviceStatusText).toBe("设备离线");
      expect(page.data.deviceStatusTone).toBe("offline");
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
      expect(page.data.deviceStatusText).toBe("设备不可用");
      expect(page.data.deviceStatusTone).toBe("error");
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
      expect(
        page.data.volumeDots.filter((dot: { on: boolean }) => dot.on),
      ).toHaveLength(0);
    });

    it("点击刷新状态：重新拉取 status", async () => {
      await loadPage(80);

      await page.onRefresh();

      expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);
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

describe("device-control 10s 前台状态轮询", () => {
  let page: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockImplementation(() => "");
    mockStatusResolve(ONLINE_STATUS);
    mockApi.controlDeviceVolume.mockResolvedValue(CONTROL_OK);
    page = harness.createInstance();
  });

  afterEach(() => {
    page.onUnload();
    jest.useRealTimers();
  });

  async function boot(status: Record<string, unknown> = ONLINE_STATUS) {
    mockStatusResolve(status);
    page.onLoad({ id: "dev-1" });
    await page.onReady();
    await flushMicrotasks();
  }

  it("onReady 起表：10s 内不请求，到点静默刷新一次", async () => {
    await boot();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(9_999);
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(2);
  });

  it("首个 onShow 早于 onReady：不重复发请求", async () => {
    page.onLoad({ id: "dev-1" });
    page.onShow();
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).not.toHaveBeenCalled();

    await page.onReady();
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);
  });

  it("离线时轮询到设备上线：自动解锁步进器", async () => {
    await boot({ ...ONLINE_STATUS, status: "offline" });
    expect(page.data.controlDisabled).toBe(true);

    mockStatusResolve({ ...ONLINE_STATUS, status: "online", volume: 80 });
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(page.data.deviceOnline).toBe(true);
    expect(page.data.controlDisabled).toBe(false);
    expect(page.data.statusHint).toBe("");
  });

  it("轮询网络异常：保留已展示音量与在线态，不回退成未知", async () => {
    await boot();
    mockApi.getDeviceStatus.mockRejectedValueOnce(new Error("Network error"));

    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(page.data.volume).toBe(80);
    expect(page.data.controlDisabled).toBe(false);
    expect(page.data.statusHint).toBe("");
  });

  it("轮询 404：切到设备不存在态并禁用", async () => {
    await boot();
    mockApi.getDeviceStatus.mockRejectedValueOnce(
      Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
    );

    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();

    expect(page.data.statusNotFound).toBe(true);
    expect(page.data.controlDisabled).toBe(true);
    expect(page.data.volume).toBeNull();
    expect(page.data.statusHint).toBe("设备不存在或已解绑");
  });

  it("status 请求在途时手动刷新：跳过叠加", async () => {
    let resolveStatus: (v: unknown) => void = () => {};
    mockApi.getDeviceStatus.mockImplementationOnce(
      () => new Promise((resolve) => (resolveStatus = resolve)),
    );

    page.onLoad({ id: "dev-1" });
    const ready = page.onReady();
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    await page.onRefresh();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    resolveStatus({ code: 0, message: "", data: ONLINE_STATUS });
    await ready;
    await flushMicrotasks();
  });

  it("onHide / onShow / onUnload：停表、回前台立即刷新并重新起表", async () => {
    await boot();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    page.onHide();
    jest.advanceTimersByTime(20_000);
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(1);

    page.onShow();
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(3);

    page.onUnload();
    jest.advanceTimersByTime(20_000);
    await flushMicrotasks();
    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(3);
  });

  it("下发请求在途时轮询：不让旧状态覆盖乐观音量", async () => {
    await boot(); // 80
    let resolveControl: (v: unknown) => void = () => {};
    mockApi.controlDeviceVolume.mockImplementationOnce(
      () => new Promise((resolve) => (resolveControl = resolve)),
    );

    const submitting = page.onVolumePlus(); // 90，请求挂起中
    await flushMicrotasks();
    expect(page.data.submitting).toBe(true);

    mockStatusResolve({ ...ONLINE_STATUS, volume: 80 });
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();
    expect(page.data.volume).toBe(90);

    resolveControl(CONTROL_OK);
    await submitting;
    expect(page.data.lastCommittedVolume).toBe(90);
  });

  it("提交成功后的静默窗口：旧状态不覆盖乐观音量", async () => {
    await boot(); // 80
    jest.advanceTimersByTime(5_000);
    await page.onVolumePlus(); // 90，静默窗口到 t+6s

    mockStatusResolve({ ...ONLINE_STATUS, volume: 80 });
    jest.advanceTimersByTime(5_000); // t=10s 轮询，仍在静默窗口内
    await flushMicrotasks();
    expect(page.data.volume).toBe(90);
    expect(page.data.lastCommittedVolume).toBe(90);

    jest.advanceTimersByTime(10_000); // t=20s，窗口已过，以设备真值为准
    await flushMicrotasks();
    expect(page.data.volume).toBe(80);
    expect(page.data.lastCommittedVolume).toBe(80);
  });
});
