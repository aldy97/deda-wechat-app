/**
 * device-list 卡片模式展示测试（最小必要）。
 * 锁定 applyConfigToDevice 的三分支行为，删除教材模式后：
 * 未知 mode（含历史教材 key）必须走兜底分支而不炸。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getDeviceList: jest.fn(),
  bindDevice: jest.fn(),
  getDeviceStatus: jest.fn(),
  getDeviceCurrentConfig: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("device-list card display mapping", () => {
  let page: any;

  beforeAll(() => {
    require("./device-list");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
  });

  function applyConfig(config: Record<string, unknown>) {
    const device: Record<string, unknown> = { id: "dev-001" };
    page.applyConfigToDevice(device, { deviceId: "dev-001", ...config });
    return device;
  }

  it("free_chat 模式展示模式名称与默认描述", () => {
    const device = applyConfig({
      mode: "free_chat",
    });
    expect(device.cardTitle).toBe("自由对话");
    expect(device.cardDesc).toBe("DEDA AI 玩偶，随时在线陪伴孩子学习与成长。");
  });

  it("历史教材模式 key 走兜底分支（教材功能已删除）", () => {
    const device = applyConfig({
      mode: "textbook_learning",
    });
    expect(device.cardTitle).toBe("textbook_learning");
    expect(device.cardSubtitle).toBe("");
    expect(device.cardDesc).toBe("DEDA AI 玩偶，随时在线陪伴孩子学习与成长。");
  });

  it("未知 mode 走兜底分支，展示原始 key 与默认文案", () => {
    const device = applyConfig({ mode: "some_future_mode" });
    expect(device.cardTitle).toBe("some_future_mode");
    expect(device.cardSubtitle).toBe("");
    expect(device.cardDesc).toBe("DEDA AI 玩偶，随时在线陪伴孩子学习与成长。");
  });

  describe("设备状态展示（对齐 MINI_PROGRAM_API.md 3.4 MQTT 真实化契约）", () => {
    function mockStatus(data: Record<string, unknown>) {
      mockApi.getDeviceStatus.mockResolvedValue({ code: 0, message: "", data });
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        code: 0,
        message: "",
        data: null,
      });
    }

    async function enrichOne() {
      const items = await page.enrichDevices([{ id: "dev-001", name: "样机" }]);
      expect(items).toHaveLength(1);
      return items[0];
    }

    it("在线且有电量：状态/电量透传，最近活跃显示相对时间", async () => {
      mockStatus({
        deviceId: "dev-001",
        status: "online",
        battery: 65,
        isCharging: null,
        lastActiveAt: new Date(Date.now() - 5 * 60000).toISOString(),
      });
      const item = await enrichOne();
      expect(item.status).toBe("online");
      expect(item.battery).toBe(65);
      expect(item.isCharging).toBeNull();
      expect(item.lastActiveText).toBe("最近活跃 5 分钟前");
      expect(item.statusNotFound).toBeFalsy();
      expect(item.statusLoading).toBe(false);
    });

    it("离线但有电量：展示离线标识且保留电量", async () => {
      mockStatus({
        deviceId: "dev-001",
        status: "offline",
        battery: 30,
        isCharging: null,
        lastActiveAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      });
      const item = await enrichOne();
      expect(item.status).toBe("offline");
      expect(item.battery).toBe(30);
      expect(item.lastActiveText).toBe("最近活跃 2 小时前");
    });

    it("设备从未上报：battery null、lastActiveText 为「暂未连接」", async () => {
      mockStatus({
        deviceId: "dev-001",
        status: "online",
        battery: null,
        isCharging: null,
        lastActiveAt: null,
      });
      const item = await enrichOne();
      expect(item.battery).toBeNull();
      expect(item.isCharging).toBeNull();
      expect(item.lastActiveText).toBe("暂未连接");
    });

    it("status 返回 404：标记设备不存在兜底态，不抛错不弹窗", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        code: 0,
        message: "",
        data: null,
      });
      const item = await enrichOne();
      expect(item.statusNotFound).toBe(true);
      expect(item.status).toBe("offline");
      expect(item.battery).toBeNull();
      expect(item.lastActiveText).toBeUndefined();
      expect(item.statusLoading).toBe(false);
      expect(harness.wx.showToast).not.toHaveBeenCalled();
    });

    it("网络/服务异常（非 404）：离线兜底但电量为 null，绝不显示 0%", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(new Error("Network error"));
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        code: 0,
        message: "",
        data: null,
      });
      const item = await enrichOne();
      expect(item.status).toBe("offline");
      expect(item.battery).toBeNull();
      expect(item.isCharging).toBeNull();
      expect(item.statusNotFound).toBeFalsy();
    });

    it("formatLastActive：null/非法时间均为「暂未连接」，1 分钟内为「刚刚」", () => {
      expect(page.formatLastActive(null)).toBe("暂未连接");
      expect(page.formatLastActive("not-a-date")).toBe("暂未连接");
      expect(
        page.formatLastActive(new Date(Date.now() - 30 * 1000).toISOString()),
      ).toBe("最近活跃 刚刚");
      expect(
        page.formatLastActive(
          new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        ),
      ).toBe("最近活跃 3 天前");
    });
  });

  describe("添加设备入口", () => {
    it("点击添加设备 → 跳转配网页", () => {
      page.onAddDevice();
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-provision/device-provision",
      });
    });

    it("点击音量控制 → 携带设备 id 跳转控制页", () => {
      page.onVolumeControl({
        currentTarget: { dataset: { id: "dev-001" } },
      });
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-control/device-control?id=dev-001",
      });
    });

    it("空列表：不自动绑定（DEV001 联调逻辑已下线），停留空态", async () => {
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.getDeviceList.mockResolvedValue({
        code: 0,
        message: "",
        data: [],
      });

      await page.loadDeviceList();

      expect(page.data.devices).toEqual([]);
      expect(page.data.loading).toBe(false);
    });
  });

  describe("SWR 缓存首帧直出与静默刷新", () => {
    beforeEach(() => {
      // getStorageSync 的 mockImplementation 不被 clearAllMocks 清除，按用例隔离
      harness.wx.getStorageSync.mockImplementation(() => "");
    });

    const CACHED_ITEM = {
      id: "dev-cache",
      name: "缓存设备",
      status: "online",
      battery: 80,
      isCharging: null,
      lastActiveAt: "2026-11-11T04:00:00.000Z",
      lastActiveText: "最近活跃 刚刚",
      cardTitle: "自由闲聊",
      cardDesc: "轻松闲聊。",
    };

    function mockNetworkList(devices: unknown[]) {
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.getDeviceList.mockResolvedValue({
        code: 0,
        message: "",
        data: devices,
      });
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-net",
          status: "offline",
          battery: 55,
          isCharging: null,
          lastActiveAt: null,
        },
      });
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        code: 0,
        message: "",
        data: null,
      });
    }

    it("有缓存：网络返回前即渲染缓存列表，不整页转圈", async () => {
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === "device_list_cache" ? [CACHED_ITEM] : "",
      );
      let resolveList!: (v: unknown) => void;
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.getDeviceList.mockReturnValue(
        new Promise((resolve) => {
          resolveList = resolve;
        }),
      );

      const pending = page.loadDeviceList();

      // 网络尚未返回：首帧已是缓存内容，且无 loading
      expect(page.data.loading).toBe(false);
      expect(page.data.devices.map((d: any) => d.id)).toEqual(["dev-cache"]);

      mockNetworkList([{ id: "dev-net", name: "新设备" }]);
      resolveList({
        code: 0,
        message: "",
        data: [{ id: "dev-net", name: "新设备" }],
      });
      await pending;

      expect(page.data.devices.map((d: any) => d.id)).toEqual(["dev-net"]);
      expect(page.data.loading).toBe(false);
    });

    it("刷新成功后写入缓存（剔除 statusLoading 等瞬态字段）", async () => {
      mockNetworkList([{ id: "dev-net", name: "新设备" }]);

      await page.loadDeviceList();

      expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
        "device_list_cache",
        expect.arrayContaining([
          expect.objectContaining({ id: "dev-net", battery: 55 }),
        ]),
      );
      const written = harness.wx.setStorageSync.mock.calls.find(
        (c: unknown[]) => c[0] === "device_list_cache",
      )[1];
      expect(written[0].statusLoading).toBeUndefined();
    });

    it("onShow 二次进入：静默刷新，loading 不翻 true、旧列表保持渲染", async () => {
      mockNetworkList([{ id: "dev-net", name: "新设备" }]);
      await page.loadDeviceList();
      expect(page.data.devices).toHaveLength(1);

      let resolveList!: (v: unknown) => void;
      mockApi.getDeviceList.mockReturnValue(
        new Promise((resolve) => {
          resolveList = resolve;
        }),
      );
      page.onShow();
      // getDeviceList 在 await ensureAuthToken 之后发起，先让微任务跑完
      await flushMicrotasks();

      // 刷新进行中：旧列表仍在，loading 保持 false
      expect(page.data.loading).toBe(false);
      expect(page.data.devices.map((d: any) => d.id)).toEqual(["dev-net"]);
      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);

      resolveList({
        code: 0,
        message: "",
        data: [{ id: "dev-net", name: "新设备" }],
      });
      await flushMicrotasks();
    });

    it("静默刷新失败：保留旧列表，不 toast 不闪空态", async () => {
      mockNetworkList([{ id: "dev-net", name: "新设备" }]);
      await page.loadDeviceList();
      harness.wx.showToast.mockClear();

      mockApi.getDeviceList.mockRejectedValue(new Error("network down"));
      await page.loadDeviceList({ silent: true });

      expect(page.data.devices.map((d: any) => d.id)).toEqual(["dev-net"]);
      expect(page.data.loading).toBe(false);
      expect(harness.wx.showToast).not.toHaveBeenCalled();
    });

    it("静默刷新期间保留旧状态/电量展示，不闪「电量...」加载态", async () => {
      mockNetworkList([{ id: "dev-net", name: "新设备" }]);
      await page.loadDeviceList();
      const before = page.data.devices[0];
      expect(before.status).toBe("offline");

      let resolveStatus!: (v: unknown) => void;
      mockApi.getDeviceStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );
      const pending = page.loadDeviceList({ silent: true });
      await flushMicrotasks();

      // enrich 进行中：沿用旧状态快照，statusLoading 不再亮起
      expect(page.data.devices[0].status).toBe("offline");
      expect(page.data.devices[0].battery).toBe(55);

      resolveStatus({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-net",
          status: "online",
          battery: 90,
          isCharging: null,
          lastActiveAt: "2026-11-11T05:00:00.000Z",
        },
      });
      await pending;
      await flushMicrotasks();
    });
  });
});
