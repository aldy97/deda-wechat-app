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

describe("device-list card display mapping", () => {
  const harness = installPageHarness();
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

  it("free_chat 模式展示子模式名称与描述", () => {
    const device = applyConfig({
      mode: "free_chat",
      conversationModeKey: "free_chat_casual",
      conversationModeName: "自由闲聊",
      conversationModeDescription: "轻松闲聊。",
    });
    expect(device.cardTitle).toBe("自由闲聊");
    expect(device.cardDesc).toBe("轻松闲聊。");
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

  describe("添加设备入口与 DEV001 自动绑定门控", () => {
    const DEV001 = {
      id: "dev-local-001",
      name: "DEV001（联调样机）",
      deviceId: "dev-local-001",
      deviceCode: "DEV001",
      networkType: "4G",
    };

    it("点击添加设备 → 跳转绑定页", () => {
      page.onAddDevice();
      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-bind/device-bind",
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

    it("dev 环境空列表：自动绑定 DEV001 联调样机并重新拉取", async () => {
      mockApi.ensureAuthToken.mockResolvedValue(undefined);
      mockApi.bindDevice.mockResolvedValue({
        code: 0,
        message: "",
        data: { success: true, deviceId: "dev-local-001", alreadyBound: false },
      });
      mockApi.getDeviceList
        .mockResolvedValueOnce({ code: 0, message: "", data: [] })
        .mockResolvedValueOnce({ code: 0, message: "", data: [DEV001] });
      mockApi.getDeviceStatus.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          deviceId: "dev-local-001",
          status: "online",
          battery: 65,
          isCharging: null,
          lastActiveAt: new Date().toISOString(),
        },
      });
      mockApi.getDeviceCurrentConfig.mockResolvedValue({
        code: 0,
        message: "",
        data: null,
      });

      await page.loadDeviceList();

      expect(mockApi.bindDevice).toHaveBeenCalledWith({
        deviceId: "dev-local-001",
      });
      expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);
      expect(page.data.devices).toHaveLength(1);
      expect(page.data.loading).toBe(false);
    });

    it("非 dev 环境空列表：不自动绑定，停留空态", async () => {
      harness.wx.getAccountInfoSync.mockReturnValue({
        miniProgram: { envVersion: "release" },
      });
      try {
        mockApi.ensureAuthToken.mockResolvedValue(undefined);
        mockApi.getDeviceList.mockResolvedValue({
          code: 0,
          message: "",
          data: [],
        });

        await page.loadDeviceList();

        expect(mockApi.bindDevice).not.toHaveBeenCalled();
        expect(page.data.devices).toEqual([]);
        expect(page.data.loading).toBe(false);
      } finally {
        harness.wx.getAccountInfoSync.mockReturnValue({
          miniProgram: { envVersion: "develop" },
        });
      }
    });
  });
});
