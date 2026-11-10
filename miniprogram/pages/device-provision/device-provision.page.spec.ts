/**
 * device-provision 配网页装配测试（page-harness）。
 * mock api 层与 ble-client / wifi-info，锁定：
 * 步骤流转、权限预检、status=0 后的认领轮询（单台自动绑定 / 多台选择 /
 * 超时明确失败 / 网络抖动容错）、绑定失败重试、页面退出清理。
 *
 * 认领链路（机芯厂约定）：BLE status=0 仅代表设备连上路由器；
 * 设备随后自行 loginMac 上线，小程序轮询 provision-candidates 认领绑定。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  bindDevice: jest.fn(),
  getProvisionCandidates: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const mockClient = {
  init: jest.fn(),
  startScan: jest.fn(),
  startDiscovery: jest.fn(),
  stopScan: jest.fn(),
  connect: jest.fn(),
  enableNotify: jest.fn(),
  sendFrame: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock("../../utils/ble-client", () => ({
  BleProvisionClient: jest.fn(() => mockClient),
}));

const mockWifi = {
  getCurrentWifi: jest.fn(),
};
jest.mock("../../utils/wifi-info", () => mockWifi);

const harness = installPageHarness();

// 补充页面用到的 wx 桩
harness.wx.getSetting = jest.fn();
harness.wx.authorize = jest.fn();
harness.wx.openSetting = jest.fn();

require("./device-provision");

const ANDROID_DEVICE = {
  deviceId: "AA:BB:CC:DD:EE:FF",
  name: "JL_DEVICE",
  localName: "JL_DEVICE",
  rssi: -45,
  advertisDataHex: "4A 4C",
};

const CANDIDATE_A = {
  deviceId: "aabbccddeeff",
  macTail: "ddeeff",
  lastSeenAt: "2026-11-10T08:00:00.000Z",
};
const CANDIDATE_B = {
  deviceId: "90fe1de7a1ca",
  macTail: "e7a1ca",
  lastSeenAt: "2026-11-10T08:00:05.000Z",
};

function grantLocation() {
  harness.wx.getSetting.mockImplementation((opt: any) =>
    opt.success({ authSetting: { "scope.userLocation": true } }),
  );
}

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

async function enterWifiStep(page: any) {
  grantLocation();
  mockClient.init.mockResolvedValue(undefined);
  mockClient.startDiscovery.mockResolvedValue(undefined);
  mockClient.startScan.mockReturnValue(jest.fn());
  mockClient.connect.mockResolvedValue(undefined);
  mockClient.enableNotify.mockResolvedValue(undefined);
  mockWifi.getCurrentWifi.mockResolvedValue({
    ssid: "Home_WiFi",
    secure: true,
  });

  await page.onStartScan();
  // 模拟扫描回调上报一台设备
  const onDevice = mockClient.startScan.mock.calls[0][0];
  onDevice(ANDROID_DEVICE);
  await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });
}

/** 推进到 status=0 已收到、认领轮询已启动的状态 */
async function enterClaiming(page: any) {
  await enterWifiStep(page);
  mockClient.sendFrame.mockResolvedValue(undefined);
  page.setData({ password: "12345678" });
  await page.onSubmitProvision();
  await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 0 } });
}

describe("device-provision 配网页", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockReturnValue("");
    page = harness.createInstance();
    page.onLoad();
  });

  afterEach(() => {
    // 释放扫描/配网/认领计时器，避免用例间泄漏
    page.stopScan();
    page.stopClaimPolling();
    if (page.provisionTimer) clearTimeout(page.provisionTimer);
  });

  it("onLoad：停留在步骤 1", () => {
    expect(page.data.step).toBe(1);
    expect(page.data.isDev).toBe(true);
  });

  it("位置权限被拒且用户不去设置：toast 提示且不启动扫描", async () => {
    harness.wx.getSetting.mockImplementation((opt: any) =>
      opt.success({ authSetting: {} }),
    );
    harness.wx.authorize.mockImplementation((opt: any) => opt.fail({}));
    harness.wx.showModal.mockImplementation((opt: any) =>
      opt.success({ confirm: false }),
    );

    await page.onStartScan();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "未获得位置权限，无法配网" }),
    );
    expect(mockClient.startScan).not.toHaveBeenCalled();
    expect(page.data.step).toBe(1);
  });

  it("扫描 → 选择设备 → 进入 WiFi 步骤，SSID 锁定为手机当前网络", async () => {
    await enterWifiStep(page);

    expect(mockClient.connect).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
    expect(mockClient.enableNotify).toHaveBeenCalled();
    expect(page.data.step).toBe(3);
    expect(page.data.ssid).toBe("Home_WiFi");
  });

  it("完整链路：status=0 → 轮询到单台候选 → 自动绑定成功", async () => {
    mockApi.getProvisionCandidates.mockResolvedValue({
      code: 0,
      message: "",
      data: { devices: [CANDIDATE_A] },
    });
    mockApi.bindDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: {
        success: true,
        deviceId: CANDIDATE_A.deviceId,
        alreadyBound: false,
      },
    });

    await enterWifiStep(page);
    mockClient.sendFrame.mockResolvedValue(undefined);
    page.setData({ password: "12345678" });

    await page.onSubmitProvision();
    expect(mockClient.sendFrame).toHaveBeenCalled();
    const frame = mockClient.sendFrame.mock.calls[0][0] as Uint8Array;
    expect(frame[0]).toBe(0x4a);
    expect(frame[1]).toBe(0x4c);
    expect(page.data.step).toBe(4);

    page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 1 } });
    expect(page.data.provisionStatusText).toContain("联网中");

    await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 0 } });
    await flushMicrotasks();

    // 绑定载荷来自服务端候选（归一化 MAC），而非 BLE 侧解析
    expect(mockApi.bindDevice).toHaveBeenCalledWith({
      deviceId: CANDIDATE_A.deviceId,
    });
    expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
      "device_list_cache",
    );
    expect(page.data.step).toBe(5);
    expect(page.data.success).toBe(true);
    expect(page.data.resultText).toContain("配网成功");
  });

  it("多台候选：禁止自动绑定，展示列表由用户选择", async () => {
    mockApi.getProvisionCandidates.mockResolvedValue({
      code: 0,
      message: "",
      data: { devices: [CANDIDATE_B, CANDIDATE_A] },
    });
    mockApi.bindDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: {
        success: true,
        deviceId: CANDIDATE_B.deviceId,
        alreadyBound: false,
      },
    });

    await enterClaiming(page);
    await flushMicrotasks();

    expect(mockApi.bindDevice).not.toHaveBeenCalled();
    expect(page.data.step).toBe(5);
    expect(page.data.claimChoice).toBe(true);
    expect(page.data.claimCandidates).toHaveLength(2);

    await page.onSelectCandidate({
      currentTarget: { dataset: { deviceId: CANDIDATE_B.deviceId } },
    });
    await flushMicrotasks();

    expect(mockApi.bindDevice).toHaveBeenCalledWith({
      deviceId: CANDIDATE_B.deviceId,
    });
    expect(page.data.success).toBe(true);
  });

  it("认领窗口内一直无设备：超时明确失败，绝不误报成功；可重试检测", async () => {
    mockApi.getProvisionCandidates.mockResolvedValue({
      code: 0,
      message: "",
      data: { devices: [] },
    });

    await enterWifiStep(page);
    mockClient.sendFrame.mockResolvedValue(undefined);
    page.setData({ password: "12345678" });
    await page.onSubmitProvision();

    jest.useFakeTimers();
    try {
      await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 0 } });
      // 第一次轮询立即发生，随后每 2s 一次；推进 60s 覆盖 30 次上限
      await jest.advanceTimersByTimeAsync(62000);

      expect(mockApi.bindDevice).not.toHaveBeenCalled();
      expect(page.data.step).toBe(5);
      expect(page.data.success).toBe(false);
      expect(page.data.claimTimeout).toBe(true);
      expect(page.data.resultText).toContain("未检测到设备上线");

      // 重试检测：设备此刻上线了 → 认领并绑定成功
      mockApi.getProvisionCandidates.mockResolvedValue({
        code: 0,
        message: "",
        data: { devices: [CANDIDATE_A] },
      });
      mockApi.bindDevice.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          success: true,
          deviceId: CANDIDATE_A.deviceId,
          alreadyBound: true,
        },
      });
      page.onRetryClaim();
      await jest.advanceTimersByTimeAsync(0);
      await flushMicrotasks();

      expect(mockApi.bindDevice).toHaveBeenCalledWith({
        deviceId: CANDIDATE_A.deviceId,
      });
      expect(page.data.success).toBe(true);
      expect(page.data.alreadyBound).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("认领轮询遇网络抖动不计失败，后续轮询照常认领", async () => {
    mockApi.getProvisionCandidates
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({
        code: 0,
        message: "",
        data: { devices: [CANDIDATE_A] },
      });
    mockApi.bindDevice.mockResolvedValue({
      code: 0,
      message: "",
      data: {
        success: true,
        deviceId: CANDIDATE_A.deviceId,
        alreadyBound: false,
      },
    });

    await enterWifiStep(page);
    mockClient.sendFrame.mockResolvedValue(undefined);
    page.setData({ password: "12345678" });
    await page.onSubmitProvision();

    jest.useFakeTimers();
    try {
      await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 0 } });
      // 第一次（立即）失败；2s 后第二次成功
      await jest.advanceTimersByTimeAsync(2000);
      await flushMicrotasks();

      expect(page.data.step).toBe(5);
      expect(page.data.success).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("绑定接口失败：bindFailed 态可重试，重试成功显示已恢复", async () => {
    mockApi.getProvisionCandidates.mockResolvedValue({
      code: 0,
      message: "",
      data: { devices: [CANDIDATE_A] },
    });
    mockApi.bindDevice.mockRejectedValueOnce(new Error("Network error"));

    await enterClaiming(page);
    await flushMicrotasks();

    expect(page.data.bindFailed).toBe(true);
    expect(page.data.success).toBe(false);

    mockApi.bindDevice.mockResolvedValueOnce({
      code: 0,
      message: "",
      data: {
        success: true,
        deviceId: CANDIDATE_A.deviceId,
        alreadyBound: true,
      },
    });
    await page.onRetryBind();

    expect(mockApi.bindDevice).toHaveBeenCalledTimes(2);
    expect(page.data.success).toBe(true);
    expect(page.data.alreadyBound).toBe(true);
  });

  it("设备返回 status=4：失败文案含 2.4GHz 提示，不发起认领", async () => {
    await enterWifiStep(page);
    mockClient.sendFrame.mockResolvedValue(undefined);
    page.setData({ password: "wrong-pass" });

    await page.onSubmitProvision();
    await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 4 } });

    expect(mockApi.getProvisionCandidates).not.toHaveBeenCalled();
    expect(mockApi.bindDevice).not.toHaveBeenCalled();
    expect(page.data.step).toBe(5);
    expect(page.data.success).toBe(false);
    expect(page.data.resultText).toContain("2.4GHz");
  });

  it("90 秒无最终状态：判超时失败，绝不显示成功", async () => {
    jest.useFakeTimers();
    try {
      await enterWifiStep(page);
      mockClient.sendFrame.mockResolvedValue(undefined);
      page.setData({ password: "12345678" });

      await page.onSubmitProvision();
      await jest.advanceTimersByTimeAsync(90000);

      expect(mockApi.getProvisionCandidates).not.toHaveBeenCalled();
      expect(mockApi.bindDevice).not.toHaveBeenCalled();
      expect(page.data.step).toBe(5);
      expect(page.data.success).toBe(false);
      expect(page.data.resultText).toContain("超时");
    } finally {
      jest.useRealTimers();
    }
  });

  it("加密网络未输密码：toast 拦截，不进入配网", async () => {
    await enterWifiStep(page);
    await page.onSubmitProvision();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "请输入 WiFi 密码" }),
    );
    expect(mockClient.sendFrame).not.toHaveBeenCalled();
    expect(page.data.step).toBe(3);
  });

  it("onUnload：断开 BLE 并清理全部监听与计时器", async () => {
    mockApi.getProvisionCandidates.mockResolvedValue({
      code: 0,
      message: "",
      data: { devices: [] },
    });
    await enterClaiming(page);
    mockClient.disconnect.mockResolvedValue(undefined);

    await page.onUnload();

    expect(mockClient.disconnect).toHaveBeenCalled();
    expect(page.client).toBeNull();
    expect(page.receiver).toBeNull();
    expect(page.claimTimer).toBe(0);
  });
});
