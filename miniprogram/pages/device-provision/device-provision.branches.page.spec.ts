/**
 * device-provision 边界与错误分支测试（page-harness）。
 *
 * 主流程与认领链路在 device-provision.page.spec.ts；本文件补权限、
 * 扫描、连接、下发、协议终态与收尾清理的失败/超时/重复触发分支。
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

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

/** 走到步骤 3：已连接设备并拿到 WiFi 列表，当前网络自动选中 */
async function enterWifiStep(page: any) {
  harness.wx.getSetting.mockImplementation((opt: any) =>
    opt.success({ authSetting: { "scope.userLocation": true } }),
  );
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
  const onDevice = mockClient.startScan.mock.calls[0][0];
  onDevice(ANDROID_DEVICE);
  await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });
  page.handleMessage({
    t1: 0x20,
    t2: 0x01,
    data: {
      wifiList: [
        { ssid: "Neighbor", rssi: -60 },
        { ssid: "Home_WiFi", rssi: -40 },
      ],
    },
  });
}

describe("device-provision 边界分支", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockReturnValue("");
    page = harness.createInstance();
    page.onLoad();
  });

  afterEach(() => {
    page.stopScan();
    page.stopClaimPolling();
    if (page.provisionTimer) clearTimeout(page.provisionTimer);
    if (page.wifiListTimer) clearTimeout(page.wifiListTimer);
  });

  describe("位置权限", () => {
    it("首次弹授权并同意：返回已授权", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: {} }),
      );
      harness.wx.authorize.mockImplementation((opt: any) => opt.success());

      await expect(page.ensureLocationPermission()).resolves.toBe(true);
      expect(harness.wx.authorize).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "scope.userLocation" }),
      );
    });

    it("拒绝后去设置并开启：返回已授权", async () => {
      let settingsCalls = 0;
      harness.wx.getSetting.mockImplementation((opt: any) => {
        settingsCalls += 1;
        opt.success({
          authSetting:
            settingsCalls === 1 ? {} : { "scope.userLocation": true },
        });
      });
      harness.wx.authorize.mockImplementation((opt: any) => opt.fail({}));
      harness.wx.showModal.mockImplementation((opt: any) =>
        opt.success({ confirm: true }),
      );
      harness.wx.openSetting.mockImplementation((opt: any) => opt.complete());

      await expect(page.ensureLocationPermission()).resolves.toBe(true);
      expect(harness.wx.openSetting).toHaveBeenCalled();
    });

    it("去设置后仍未开启：返回未授权", async () => {
      let settingsCalls = 0;
      harness.wx.getSetting.mockImplementation((opt: any) => {
        settingsCalls += 1;
        opt.success({ authSetting: settingsCalls === 1 ? {} : {} });
      });
      harness.wx.authorize.mockImplementation((opt: any) => opt.fail({}));
      harness.wx.showModal.mockImplementation((opt: any) =>
        opt.success({ confirm: true }),
      );
      harness.wx.openSetting.mockImplementation((opt: any) => opt.complete());

      await expect(page.ensureLocationPermission()).resolves.toBe(false);
    });

    it("读取设置直接失败：走弹窗，用户取消后返回未授权", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.fail(new Error("denied")),
      );
      harness.wx.showModal.mockImplementation((opt: any) =>
        opt.success({ confirm: false }),
      );

      await expect(page.ensureLocationPermission()).resolves.toBe(false);
      expect(harness.wx.openSetting).not.toHaveBeenCalled();
    });
  });

  describe("扫描", () => {
    it("已在扫描中：重复点击直接返回", async () => {
      page.setData({ scanning: true });

      await page.onStartScan();

      expect(mockClient.init).not.toHaveBeenCalled();
    });

    it("蓝牙初始化失败（Error）：提示错误原文", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockRejectedValue(new Error("蓝牙不可用"));

      await page.onStartScan();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "蓝牙不可用",
        icon: "none",
      });
      expect(page.data.step).toBe(1);
    });

    it("蓝牙初始化失败（非 Error）：回落兜底文案", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockRejectedValue("boom");

      await page.onStartScan();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "蓝牙初始化失败",
        icon: "none",
      });
    });

    it("启动发现失败：scanHint 显示错误并结束扫描态", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockResolvedValue(undefined);
      mockClient.startScan.mockReturnValue(jest.fn());
      mockClient.startDiscovery.mockRejectedValue(new Error("扫描启动失败"));

      await page.onStartScan();

      expect(page.data.scanHint).toBe("扫描启动失败");
      expect(page.data.scanning).toBe(false);
    });

    it("扫描超时且未发现设备：给出确认机芯的提示", async () => {
      jest.useFakeTimers();
      try {
        harness.wx.getSetting.mockImplementation((opt: any) =>
          opt.success({ authSetting: { "scope.userLocation": true } }),
        );
        mockClient.init.mockResolvedValue(undefined);
        mockClient.startScan.mockReturnValue(jest.fn());
        mockClient.startDiscovery.mockResolvedValue(undefined);

        await page.onStartScan();
        jest.advanceTimersByTime(10000);

        expect(page.data.scanHint).toBe(
          "未发现设备，请确认机芯已开机并靠近手机后重试",
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("扫描超时但已有设备：不再提示未发现设备", async () => {
      jest.useFakeTimers();
      try {
        harness.wx.getSetting.mockImplementation((opt: any) =>
          opt.success({ authSetting: { "scope.userLocation": true } }),
        );
        mockClient.init.mockResolvedValue(undefined);
        mockClient.startScan.mockReturnValue(jest.fn());
        mockClient.startDiscovery.mockResolvedValue(undefined);

        await page.onStartScan();
        const onDevice = mockClient.startScan.mock.calls[0][0];
        onDevice(ANDROID_DEVICE);
        jest.advanceTimersByTime(10000);

        // 发现设备后回调会清空搜索提示；超时不再写「未发现设备」
        expect(page.data.scanHint).toBe("");
        expect(page.data.devices).toHaveLength(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("重新扫描：先停扫描再重新开始", async () => {
      const stop = jest.fn();
      page.scanStopper = stop;
      const startSpy = jest
        .spyOn(page, "onStartScan")
        .mockResolvedValue(undefined);

      page.onRescan();

      expect(stop).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("连接设备", () => {
    it("设备下标越界：不发起连接", async () => {
      await page.onSelectDevice({ currentTarget: { dataset: { index: 9 } } });

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it("连接中重复选择：忽略", async () => {
      page.setData({ connecting: true });

      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it("连接失败（Error）：展示错误并清理会话", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockResolvedValue(undefined);
      mockClient.startScan.mockReturnValue(jest.fn());
      mockClient.startDiscovery.mockResolvedValue(undefined);
      mockClient.connect.mockRejectedValue(new Error("连接超时"));
      mockClient.disconnect.mockResolvedValue(undefined);

      await page.onStartScan();
      const onDevice = mockClient.startScan.mock.calls[0][0];
      onDevice(ANDROID_DEVICE);
      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(page.data.connectError).toBe("连接超时");
      expect(page.data.connecting).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it("连接失败（非 Error）：回落兜底文案", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockResolvedValue(undefined);
      mockClient.startScan.mockReturnValue(jest.fn());
      mockClient.startDiscovery.mockResolvedValue(undefined);
      mockClient.connect.mockRejectedValue("boom");
      mockClient.disconnect.mockResolvedValue(undefined);

      await page.onStartScan();
      const onDevice = mockClient.startScan.mock.calls[0][0];
      onDevice(ANDROID_DEVICE);
      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(page.data.connectError).toBe("连接设备失败");
    });

    it("读取手机当前 WiFi 失败：不阻断进入步骤 3", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockResolvedValue(undefined);
      mockClient.startScan.mockReturnValue(jest.fn());
      mockClient.startDiscovery.mockResolvedValue(undefined);
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.enableNotify.mockResolvedValue(undefined);
      mockWifi.getCurrentWifi.mockRejectedValue(new Error("no wifi"));

      await page.onStartScan();
      const onDevice = mockClient.startScan.mock.calls[0][0];
      onDevice(ANDROID_DEVICE);
      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(page.data.step).toBe(3);
      expect(page.data.phoneSsid).toBe("");
    });
  });

  describe("步骤 3 交互与下发", () => {
    it("WiFi 选择与手动输入：沿用手机网络安全标记", () => {
      page.setData({
        step: 3,
        phoneSsid: "Home_WiFi",
        phoneWifiSecure: false,
        wifiList: [
          { ssid: "Home_WiFi", rssi: -40 },
          { ssid: "Neighbor", rssi: -60 },
        ],
      });

      page.onSelectWifi({ currentTarget: { dataset: { ssid: "Home_WiFi" } } });
      expect(page.data).toMatchObject({ ssid: "Home_WiFi", wifiSecure: false });

      page.onSelectWifi({ currentTarget: { dataset: { ssid: "Neighbor" } } });
      expect(page.data).toMatchObject({ ssid: "Neighbor", wifiSecure: true });

      page.onSelectWifi({ currentTarget: { dataset: { ssid: "" } } });
      expect(page.data.ssid).toBe("Neighbor");

      page.onEnableManualInput();
      expect(page.data).toMatchObject({
        ssid: "",
        ssidEditable: true,
        wifiSecure: true,
      });
    });

    it("SSID 与密码输入变化写入 data", () => {
      page.onSsidChange({ detail: "My_WiFi" });
      page.onPasswordChange({ detail: "secret" });

      expect(page.data.ssid).toBe("My_WiFi");
      expect(page.data.password).toBe("secret");
    });

    it("会话失效时下发：提示重新扫描并回到步骤 1", async () => {
      await page.onSubmitProvision();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "连接已失效，请重新扫描",
        icon: "none",
      });
      expect(page.data.step).toBe(1);
    });

    it("未选 WiFi：按是否手动输入给出不同提示", async () => {
      await enterWifiStep(page);
      page.setData({ ssid: "" });

      await page.onSubmitProvision();
      expect(harness.wx.showToast).toHaveBeenLastCalledWith({
        title: "请先选择 WiFi",
        icon: "none",
      });

      page.setData({ ssidEditable: true });
      await page.onSubmitProvision();
      expect(harness.wx.showToast).toHaveBeenLastCalledWith({
        title: "请输入手机当前连接的 WiFi 名称",
        icon: "none",
      });
    });

    it("加密网络未填密码：提示补密码", async () => {
      await enterWifiStep(page);
      page.setData({ ssid: "Neighbor", wifiSecure: true, password: "" });

      await page.onSubmitProvision();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "请输入 WiFi 密码",
        icon: "none",
      });
    });

    it("SSID 超长：配置帧生成失败时提示", async () => {
      await enterWifiStep(page);
      page.setData({ ssid: "x".repeat(40), password: "12345678" });

      await page.onSubmitProvision();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "SSID 或密码字节数超限",
        icon: "none",
      });
    });

    it("下发失败：直接判配网失败", async () => {
      await enterWifiStep(page);
      page.setData({ password: "12345678" });
      mockClient.sendFrame.mockRejectedValue(new Error("write failed"));

      await page.onSubmitProvision();

      expect(page.data).toMatchObject({
        step: 5,
        success: false,
        resultText: "配网信息发送失败，请返回重新扫描并重试",
      });
    });

    it("下发后超时：按未获得最终结果判失败", async () => {
      jest.useFakeTimers();
      try {
        await enterWifiStep(page);
        page.setData({ password: "12345678" });
        mockClient.sendFrame.mockResolvedValue(undefined);

        await page.onSubmitProvision();
        jest.advanceTimersByTime(90000);

        expect(page.data).toMatchObject({
          step: 5,
          success: false,
          resultText: "配网超时，请检查路由器后重试",
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("协议终态", () => {
    it("WiFi 列表帧过滤非法条目，缺失 rssi 记为 null", () => {
      page.handleMessage({
        t1: 0x20,
        t2: 0x01,
        data: {
          wifiList: [
            { ssid: "", rssi: -40 },
            { ssid: 123, rssi: -50 },
            { ssid: "NoRssi" },
            { ssid: "Good", rssi: -60 },
          ],
        },
      });

      expect(page.data.wifiList).toEqual([
        { ssid: "Good", rssi: -60 },
        { ssid: "NoRssi", rssi: null },
      ]);
      expect(page.data.wifiListLoading).toBe(false);
    });

    it("状态帧 status 非数值：忽略", () => {
      page.setData({ provisionStatusText: "等待设备联网…" });

      page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: "x" } });

      expect(page.data.provisionStatusText).toBe("等待设备联网…");
      expect(page.data.step).toBe(1);
    });

    it("status=1：仅更新联网中文案", async () => {
      await enterWifiStep(page);
      page.setData({ password: "12345678" });
      mockClient.sendFrame.mockResolvedValue(undefined);
      await page.onSubmitProvision();

      page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 1 } });

      expect(page.data.provisionStatusText).toBe("设备联网中，请稍候…");
      expect(page.data.step).toBe(4);
    });

    it("非 0 终态：按协议文案判失败", async () => {
      await enterWifiStep(page);

      await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 4 } });

      expect(page.data).toMatchObject({
        step: 5,
        success: false,
        resultText: "WiFi 连接失败，请检查密码，并确认手机连接的是 2.4GHz 网络",
      });
    });

    it("已进入终态后重复帧：不再改写结果", async () => {
      page.finished = true;
      page.setData({ step: 5, resultText: "已结束" });

      await page.finishConfig(2);
      page.finishWithError("重复错误");

      expect(page.data.resultText).toBe("已结束");
    });
  });

  describe("认领与收尾", () => {
    it("设备断开蓝牙：转入认领轮询", () => {
      page.setData({ provisioning: true });
      page.provisionTimer = setTimeout(() => undefined, 9999);

      page.handleUnexpectedDisconnect();

      // 状态文案由 startClaimPolling 统一下发，这里锁定终态与计时器交接
      expect(page.data.provisionStatusText).toBe("设备已联网，正在完成绑定…");
      expect(page.claimTimer).toBeTruthy();
      expect(page.provisionTimer).toBe(0);
    });

    it("未在下发中/已结束/已在认领时断连：忽略", () => {
      page.finished = true;
      page.handleUnexpectedDisconnect();
      expect(page.claimTimer).toBeFalsy();

      page.finished = false;
      page.setData({ provisioning: false });
      page.handleUnexpectedDisconnect();
      expect(page.claimTimer).toBeFalsy();

      page.setData({ provisioning: true });
      page.claimTimer = setTimeout(() => undefined, 9999) as any;
      page.handleUnexpectedDisconnect();
      expect(page.claimTimer).toBeTruthy();
      clearTimeout(page.claimTimer);
      page.claimTimer = 0;
    });

    it("重试检测：回到步骤 4 并重新启动认领", () => {
      mockApi.getProvisionCandidates.mockResolvedValue({
        code: 0,
        message: "",
        data: { devices: [] },
      });

      page.onRetryClaim();

      expect(page.data).toMatchObject({ step: 4, provisioning: true });
      expect(page.claimTimer).toBeTruthy();
    });

    it("重绑缺少 deviceId：直接返回", async () => {
      await page.onRetryBind();

      expect(mockApi.bindDevice).not.toHaveBeenCalled();
    });

    it("重绑已有 deviceId：重新调用绑定接口", async () => {
      page.claimDeviceId = "aabbccddeeff";
      mockApi.bindDevice.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          success: true,
          deviceId: "aabbccddeeff",
          alreadyBound: true,
          hasChildProfile: true,
        },
      });

      await page.onRetryBind();

      expect(mockApi.bindDevice).toHaveBeenCalledWith({
        deviceId: "aabbccddeeff",
      });
      expect(page.data.bindFailed).toBe(false);
    });

    it("失败后重新开始：清理会话并回到步骤 1", async () => {
      await enterWifiStep(page);
      mockClient.disconnect.mockResolvedValue(undefined);

      await page.onRestart();

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(page.data).toMatchObject({
        step: 1,
        devices: [],
        ssid: "",
        password: "",
        resultText: "",
      });
    });

    it("页面卸载：清理扫描与连接", async () => {
      await enterWifiStep(page);
      const stop = jest.fn();
      page.scanStopper = stop;
      page.setData({ scanning: true });

      page.onUnload();
      await flushMicrotasks();

      expect(stop).toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(page.data.scanning).toBe(false);
    });
  });

  describe("其余守卫分支", () => {
    it("扫描回调：信号未知、缺少可选字段时也能展示", async () => {
      harness.wx.getSetting.mockImplementation((opt: any) =>
        opt.success({ authSetting: { "scope.userLocation": true } }),
      );
      mockClient.init.mockResolvedValue(undefined);
      mockClient.startScan.mockReturnValue(jest.fn());
      mockClient.startDiscovery.mockResolvedValue(undefined);

      await page.onStartScan();
      const onDevice = mockClient.startScan.mock.calls[0][0];
      onDevice({ deviceId: "x", name: "JL", rssi: null, advertisDataHex: "" });

      expect(page.data.devices[0]).toMatchObject({
        deviceId: "x",
        rssiText: "未知",
      });
    });

    it("重复停止扫描：没有计时器时安全返回", () => {
      page.stopScan();
      page.stopScan();

      expect(page.data.scanning).toBe(false);
    });

    it("连接会话已失效：选择设备不动作", async () => {
      page.setData({ devices: [ANDROID_DEVICE] });
      page.client = null;

      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it("自动选中：非步骤 3 / 已有选择 / 手机网络缺失或不在列表时都不改写", () => {
      page.setData({
        step: 4,
        ssid: "",
        phoneSsid: "Home",
        wifiList: [{ ssid: "Home", rssi: -40 }],
      });
      page.maybeAutoSelect();
      expect(page.data.ssid).toBe("");

      page.setData({ step: 3, ssid: "Chosen" });
      page.maybeAutoSelect();
      expect(page.data.ssid).toBe("Chosen");

      page.setData({ ssid: "", phoneSsid: "" });
      page.maybeAutoSelect();
      expect(page.data.ssid).toBe("");

      page.setData({
        phoneSsid: "Home",
        wifiList: [{ ssid: "Other", rssi: -40 }],
      });
      page.maybeAutoSelect();
      expect(page.data.ssid).toBe("");
    });

    it("下发中重复提交：忽略", async () => {
      page.setData({ provisioning: true });
      page.client = mockClient;
      page.receiver = () => undefined;

      await page.onSubmitProvision();

      expect(mockClient.sendFrame).not.toHaveBeenCalled();
    });

    it("非 WiFi 列表 / 状态帧：直接忽略", () => {
      page.handleMessage({ t1: 0x99, t2: 0x99, data: {} });

      expect(page.data.step).toBe(1);
    });

    it("多台候选选择：下发中或缺少 deviceId 时忽略", async () => {
      page.setData({ provisioning: true });
      await page.onSelectCandidate({
        currentTarget: { dataset: { deviceId: "aabbccddeeff" } },
      });

      page.setData({ provisioning: false });
      await page.onSelectCandidate({ currentTarget: { dataset: {} } });

      expect(mockApi.bindDevice).not.toHaveBeenCalled();
    });

    it("清理设备列表缓存失败不影响绑定成功", async () => {
      harness.wx.removeStorageSync.mockImplementation(() => {
        throw new Error("storage");
      });
      mockApi.bindDevice.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          success: true,
          deviceId: "aabbccddeeff",
          alreadyBound: false,
          hasChildProfile: false,
        },
      });

      await expect(page.claimBind("aabbccddeeff")).resolves.toBe(true);
      expect(page.data.success).toBe(true);
    });

    it("认领轮询：已完成或在途时跳过", async () => {
      page.finished = true;
      await page.pollClaim();
      expect(mockApi.getProvisionCandidates).not.toHaveBeenCalled();

      page.finished = false;
      page.pollInFlight = true;
      await page.pollClaim();
      expect(mockApi.getProvisionCandidates).not.toHaveBeenCalled();
    });

    it("没有计时器时停止认领轮询：安全返回", () => {
      page.claimTimer = 0;

      expect(() => page.stopClaimPolling()).not.toThrow();
    });

    it("没有 client 时清理会话：跳过断开", async () => {
      page.client = null;

      await page.cleanupSession();

      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it("非开发环境：关闭调试日志后主流程照常", async () => {
      page.setData({ isDev: false });

      await enterWifiStep(page);
      page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 1 } });

      expect(page.data.step).toBe(3);
      expect(page.data.ssid).toBe("Home_WiFi");
      expect(page.data.provisionStatusText).toBe("设备联网中，请稍候…");
    });

    it("未知终态：使用兜底文案", async () => {
      await page.handleMessage({ t1: 0x10, t2: 0x02, data: { status: 99 } });

      expect(page.data.resultText).toBe("设备返回了未知状态，请重试");
    });

    it("认领返回时页面已结束：丢弃本轮结果", async () => {
      mockApi.getProvisionCandidates.mockImplementation(() => {
        page.finished = true;
        return Promise.resolve({
          code: 0,
          message: "",
          data: { devices: [] },
        });
      });

      await page.pollClaim();

      expect(mockApi.bindDevice).not.toHaveBeenCalled();
    });

    it("重绑下发中：忽略本次点击", async () => {
      page.claimDeviceId = "aabbccddeeff";
      page.setData({ provisioning: true });

      await page.onRetryBind();

      expect(mockApi.bindDevice).not.toHaveBeenCalled();
    });

    it("密码字节数超限：配置帧生成失败时提示", async () => {
      await enterWifiStep(page);
      page.setData({
        ssid: "Home_WiFi",
        wifiSecure: true,
        password: "p".repeat(80),
      });

      await page.onSubmitProvision();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "SSID 或密码字节数超限",
        icon: "none",
      });
    });

    it("WiFi 列表帧缺少列表字段：按空列表处理", () => {
      page.handleMessage({ t1: 0x20, t2: 0x01, data: {} });

      expect(page.data.wifiList).toEqual([]);
      expect(page.data.wifiListLoading).toBe(false);
    });

    it("认领请求失败且已达上限：判认领超时", async () => {
      page.claimAttempts = 30;
      mockApi.getProvisionCandidates.mockRejectedValue(new Error("network"));

      await page.pollClaim();

      expect(page.data.claimTimeout).toBe(true);
      expect(page.data.resultText).toBe(
        "未检测到设备上线，请重启机芯后重新配网",
      );
    });

    it("设备列表为空时选择：不发起连接", async () => {
      page.setData({ devices: [] });
      page.client = mockClient;

      await page.onSelectDevice({ currentTarget: { dataset: { index: 0 } } });

      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it("首字节匹配但次字节不符的帧：按非状态帧忽略", () => {
      page.handleMessage({ t1: 0x10, t2: 0x99, data: { status: 0 } });

      expect(page.data.step).toBe(1);
      expect(page.finished).toBe(false);
    });

    it("卸载时清掉配网与 WiFi 列表计时器", async () => {
      await enterWifiStep(page);
      page.setData({ password: "12345678" });
      mockClient.sendFrame.mockResolvedValue(undefined);
      await page.onSubmitProvision();
      page.wifiListTimer = setTimeout(() => undefined, 9999);

      page.onUnload();
      await flushMicrotasks();

      expect(page.provisionTimer).toBe(0);
      expect(page.wifiListTimer).toBe(0);
    });
  });
});
