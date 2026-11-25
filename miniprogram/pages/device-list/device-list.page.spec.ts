/**
 * device-list 卡片展示测试。
 * 锁定「今日陪伴摘要 + 设备状态」驱动的正文文案、今日数据透传与缓存跨天清理。
 */
import { installPageHarness } from "../../tests/page-harness";
import { localDateKey } from "./device-list.utils";

const mockApi = {
  getDeviceList: jest.fn(),
  bindDevice: jest.fn(),
  getDeviceStatus: jest.fn(),
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

  describe("设备状态展示（对齐 MINI_PROGRAM_API.md 3.4 MQTT 真实化契约）", () => {
    function mockStatus(data: Record<string, unknown>) {
      mockApi.getDeviceStatus.mockResolvedValue({ code: 0, message: "", data });
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

  describe("今日陪伴摘要", () => {
    function mockOnlineStatus(status: "online" | "offline") {
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status,
          battery: 70,
          isCharging: null,
          lastActiveAt: null,
        },
      });
    }

    it("列表返回 todayUsage：正文展示时长与句数", async () => {
      mockOnlineStatus("online");
      const [item] = await page.enrichDevices([
        {
          id: "dev-001",
          name: "样机",
          todayUsage: { date: "2026-11-25", durationMinutes: 4, turnCount: 7 },
        },
      ]);

      expect(item.cardTitle).toBe("今天陪伴 4 分钟");
      expect(item.cardSubtitle).toBe("说了 7 句话");
      expect(item.cardDesc).toBe("");
    });

    it("离线但有今日数据：不重复顶部离线状态", async () => {
      mockOnlineStatus("offline");
      const [item] = await page.enrichDevices([
        {
          id: "dev-001",
          name: "样机",
          todayUsage: { date: "2026-11-25", durationMinutes: 2, turnCount: 3 },
        },
      ]);

      expect(item.cardTitle).toBe("今天陪伴 2 分钟");
      expect(item.cardSubtitle).toBe("说了 3 句话");
      expect(item.cardDesc).toBe("");
    });

    it("今日 0 数据：只给事实，不附引导", async () => {
      mockOnlineStatus("online");
      const [item] = await page.enrichDevices([
        {
          id: "dev-001",
          name: "样机",
          todayUsage: { date: "2026-11-25", durationMinutes: 0, turnCount: 0 },
        },
      ]);

      expect(item.cardTitle).toBe("今天还没和 Elly 聊天");
      expect(item.cardSubtitle).toBe("");
      expect(item.cardDesc).toBe("");
    });

    it("status 404：正文留空，由顶部「设备不存在」表达", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      const [item] = await page.enrichDevices([
        {
          id: "dev-001",
          name: "样机",
          todayUsage: { date: "2026-11-25", durationMinutes: 4, turnCount: 7 },
        },
      ]);

      expect(item.statusNotFound).toBe(true);
      expect(item.cardTitle).toBe("");
    });

    it("旧服务端无 todayUsage：正文留空，不冒充在线文案", async () => {
      mockOnlineStatus("online");
      const [item] = await page.enrichDevices([
        { id: "dev-001", name: "样机" },
      ]);

      expect(item.cardTitle).toBe("");
      expect(item.cardDesc).toBe("");
    });

    it("静默刷新失败：沿用旧状态，不把在线设备误标离线", async () => {
      page.fetchDeviceStatus = jest
        .fn()
        .mockRejectedValue(new Error("network down"));
      const [item] = await page.enrichDevices(
        [{ id: "dev-001", name: "样机" }],
        [
          {
            id: "dev-001",
            name: "样机",
            status: "online",
            battery: 80,
            todayUsage: {
              date: "2026-11-25",
              durationMinutes: 4,
              turnCount: 7,
            },
          },
        ],
      );

      expect(item.status).toBe("online");
      expect(item.cardTitle).toBe("");
    });
  });

  describe("顶部状态标签", () => {
    it("加载中：标签为连接中，不提前判离线", () => {
      const item: Record<string, unknown> = { statusLoading: true };
      page.applyStatusTag(item);

      expect(item.statusLabel).toBe("连接中");
      expect(item.statusTone).toBe("offline");
    });

    it("在线/离线透传到标签", async () => {
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status: "online",
          battery: 70,
          isCharging: null,
          lastActiveAt: null,
        },
      });
      const [online] = await page.enrichDevices([
        { id: "dev-001", name: "样机" },
      ]);
      expect(online.statusLabel).toBe("在线");
      expect(online.statusTone).toBe("online");

      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status: "offline",
          battery: 70,
          isCharging: null,
          lastActiveAt: null,
        },
      });
      const [offline] = await page.enrichDevices([
        { id: "dev-001", name: "样机" },
      ]);
      expect(offline.statusLabel).toBe("离线");
      expect(offline.statusTone).toBe("offline");
    });

    it("404：标签为设备不存在", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      const [item] = await page.enrichDevices([
        { id: "dev-001", name: "样机" },
      ]);

      expect(item.statusLabel).toBe("设备不存在");
      expect(item.statusTone).toBe("offline");
    });
  });

  describe("网络信号徽标（MQTT v1.8）", () => {
    function mockWifiStatus(
      rssi: number | null,
      extra: Record<string, unknown> = {},
    ) {
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status: "online",
          battery: 70,
          isCharging: false,
          networkMode: "wifi",
          wifiRssi: rssi,
          lastActiveAt: null,
          ...extra,
        },
      });
    }

    async function enrichOne(previous?: any[]) {
      const items = await page.enrichDevices(
        [{ id: "dev-001", name: "样机" }],
        previous,
      );
      return items[0];
    }

    it("wifi 强信号（-48）：不制造噪音，徽标为 null 但字段透传", async () => {
      mockWifiStatus(-48);
      const item = await enrichOne();
      expect(item.networkMode).toBe("wifi");
      expect(item.wifiRssi).toBe(-48);
      expect(item.networkBadge).toBeNull();
    });

    it("wifi 一般（-65）：展示「信号一般」", async () => {
      mockWifiStatus(-65);
      const item = await enrichOne();
      expect(item.networkBadge).toEqual({
        tone: "warning",
        text: "信号一般",
      });
    });

    it("wifi 弱（-75）：展示「信号弱」", async () => {
      mockWifiStatus(-75);
      const item = await enrichOne();
      expect(item.networkBadge).toEqual({ tone: "danger", text: "信号弱" });
    });

    it("4G：展示 4G 标签，wifiRssi 为 null", async () => {
      mockWifiStatus(null, { networkMode: "4g" });
      const item = await enrichOne();
      expect(item.networkMode).toBe("4g");
      expect(item.wifiRssi).toBeNull();
      expect(item.networkBadge).toEqual({ tone: "neutral", text: "4G" });
    });

    it("离线：不展示徽标，但保留最后已知网络字段", async () => {
      mockWifiStatus(-75, { status: "offline" });
      const item = await enrichOne();
      expect(item.status).toBe("offline");
      expect(item.wifiRssi).toBe(-75);
      expect(item.networkBadge).toBeNull();
    });

    it("老固件/切网中（字段缺失或 null）：不展示", async () => {
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status: "online",
          battery: 70,
          isCharging: false,
          lastActiveAt: null,
        },
      });
      const item = await enrichOne();
      expect(item.networkMode).toBeNull();
      expect(item.wifiRssi).toBeNull();
      expect(item.networkBadge).toBeNull();
    });

    it("status 404：清空网络字段与徽标", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(
        Object.assign(new Error("HTTP 404"), { statusCode: 404 }),
      );
      const item = await enrichOne([
        { id: "dev-001", networkMode: "wifi", wifiRssi: -75 },
      ]);
      expect(item.networkMode).toBeNull();
      expect(item.wifiRssi).toBeNull();
      expect(item.networkBadge).toBeNull();
    });

    it("刷新失败（非 404）：按离线兜底清空徽标，不抛错", async () => {
      mockApi.getDeviceStatus.mockRejectedValue(new Error("Network error"));
      const item = await enrichOne([
        {
          id: "dev-001",
          status: "online",
          networkMode: "wifi",
          wifiRssi: -75,
          networkBadge: { tone: "danger", text: "信号弱" },
        },
      ]);
      // 与既有电量口径一致：非 404 失败按离线处理，不展示可能已过期的信号
      expect(item.status).toBe("offline");
      expect(item.networkBadge).toBeNull();
    });

    it("静默刷新：网络返回前沿用旧徽标，不闪烁", async () => {
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.getDeviceList.mockResolvedValue({
        code: 0,
        message: "",
        data: [{ id: "dev-001", name: "样机" }],
      });
      mockWifiStatus(-75);
      await page.loadDeviceList();
      expect(page.data.devices[0].networkBadge).toEqual({
        tone: "danger",
        text: "信号弱",
      });

      let resolveStatus!: (v: unknown) => void;
      mockApi.getDeviceStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );
      const pending = page.loadDeviceList({ silent: true });
      await flushMicrotasks();
      expect(page.data.devices[0].networkBadge).toEqual({
        tone: "danger",
        text: "信号弱",
      });

      resolveStatus({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-001",
          status: "online",
          battery: 70,
          isCharging: false,
          networkMode: "wifi",
          wifiRssi: -48,
          lastActiveAt: null,
        },
      });
      await pending;
      await flushMicrotasks();
      expect(page.data.devices[0].networkBadge).toBeNull();
    });

    it("缓存快照包含网络字段（首帧直出不丢字段）", async () => {
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.getDeviceList.mockResolvedValue({
        code: 0,
        message: "",
        data: [{ id: "dev-001", name: "样机" }],
      });
      mockWifiStatus(-65);

      await page.loadDeviceList();

      const written = harness.wx.setStorageSync.mock.calls.find(
        (c: unknown[]) => c[0] === "device_list_cache",
      )[1];
      expect(written[0].networkMode).toBe("wifi");
      expect(written[0].wifiRssi).toBe(-65);
      expect(written[0].networkBadge).toEqual({
        tone: "warning",
        text: "信号一般",
      });
    });
  });

  describe("添加设备入口", () => {
    it("点击添加设备 → 跳转配网页", () => {
      page.onAddDevice();
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-provision/device-provision",
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

  describe("卡片入口", () => {
    it("onShow 首次进入（onReady 之前）：不重复请求设备列表", () => {
      page.hasInitialLoaded = false;
      page.onShow();
      expect(mockApi.getDeviceList).not.toHaveBeenCalled();
    });

    it("设置入口：跳转设备设置页", () => {
      page.onSettingsTap({ currentTarget: { dataset: { id: "dev-001" } } });
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-setting/device-setting?id=dev-001",
      });
    });

    it("查看对话：跳转对话记录页", () => {
      page.onViewChat({ currentTarget: { dataset: { id: "dev-001" } } });
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/chat-history/chat-history?id=dev-001",
      });
    });

    it("未设置孩子档案：点击姓名区跳转设置页", () => {
      page.data.devices = [{ id: "dev-001", name: "样机", childProfile: null }];
      page.onChildNameTap({ currentTarget: { dataset: { id: "dev-001" } } });
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-setting/device-setting?id=dev-001",
      });
    });

    it("已有孩子档案：点击姓名区不跳转", () => {
      page.data.devices = [
        { id: "dev-001", name: "样机", childProfile: { name: "二狗" } },
      ];
      page.onChildNameTap({ currentTarget: { dataset: { id: "dev-001" } } });
      expect(harness.wx.navigateTo).not.toHaveBeenCalled();
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
    }

    it("缓存读取异常：返回 false 且不抛错", () => {
      harness.wx.getStorageSync.mockImplementation(() => {
        throw new Error("storage broken");
      });

      expect(page.restoreDeviceListCache()).toBe(false);
    });

    it("缓存写入异常：告警但不影响页面", () => {
      harness.wx.setStorageSync.mockImplementation(() => {
        throw new Error("storage full");
      });

      expect(() => page.writeDeviceListCache([{ id: "dev-x" }])).not.toThrow();
    });

    it("缓存中的今日数据当天有效：首帧直接展示陪伴时长", () => {
      const todayUsage = {
        date: localDateKey(new Date()),
        durationMinutes: 23,
        turnCount: 46,
      };
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === "device_list_cache"
          ? [{ ...CACHED_ITEM, todayUsage, cardTitle: "旧标题" }]
          : "",
      );

      expect(page.restoreDeviceListCache()).toBe(true);
      expect(page.data.devices[0].todayUsage).toEqual(todayUsage);
      expect(page.data.devices[0].cardTitle).toBe("今天陪伴 23 分钟");
      expect(page.data.devices[0].cardSubtitle).toBe("说了 46 句话");
    });

    it("缓存中的 todayUsage 跨天：恢复时清空，正文留空", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === "device_list_cache"
          ? [
              {
                ...CACHED_ITEM,
                todayUsage: {
                  date: localDateKey(yesterday),
                  durationMinutes: 23,
                  turnCount: 46,
                },
                cardTitle: "旧标题",
              },
            ]
          : "",
      );

      expect(page.restoreDeviceListCache()).toBe(true);
      expect(page.data.devices[0].todayUsage).toBeNull();
      expect(page.data.devices[0].cardTitle).toBe("");
    });

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
      expect(written[0].cardTitle).toBeUndefined();
      expect(written[0].cardSubtitle).toBeUndefined();
      expect(written[0].cardDesc).toBeUndefined();
      expect(written[0].statusLabel).toBeUndefined();
      expect(written[0].statusTone).toBeUndefined();
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
