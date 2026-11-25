/**
 * sleep-manage 配置读写与交互装配测试。
 *
 * 覆盖口径：页面 data 默认值、onLoad/onReady 装配、哄睡配置加载与保存、
 * 时间与时长弹窗的临时值/确定回写、引导展开、内容占位提示。
 * 通知订阅链路由 sleep-manage.page.spec.ts 单独锁定，本文件默认跳过授权弹窗。
 */
import { getSleepConfig, updateSleepConfig } from "../../api/api";
import {
  requestSleepReminderSubscription,
  silentTopUpSleepReminder,
} from "../../utils/push-subscription";
import { installPageHarness } from "../../tests/page-harness";

jest.mock("../../api/api", () => ({
  getSleepConfig: jest.fn(),
  updateSleepConfig: jest.fn(),
}));
jest.mock("../../utils/push-subscription", () => ({
  requestSleepReminderSubscription: jest.fn().mockResolvedValue("accept"),
  silentTopUpSleepReminder: jest.fn(),
}));

const mockGetSleepConfig = getSleepConfig as jest.Mock;
const mockUpdateSleepConfig = updateSleepConfig as jest.Mock;
const mockRequestSubscription = requestSleepReminderSubscription as jest.Mock;
const mockSilentTopUp = silentTopUpSleepReminder as jest.Mock;

const SUBSCRIBE_ASKED_KEY = "sleepReminderSubscribeAsked";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const okResponse = <T>(data: T) => ({ code: 0, message: "success", data });

describe("sleep-manage 配置与交互", () => {
  const harness = installPageHarness();

  beforeAll(() => {
    require("./sleep-manage");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    // 预置「已请求过授权」，让配置用例不触发订阅弹窗
    harness.wx.getStorageSync.mockReturnValue("1");
    mockGetSleepConfig.mockResolvedValue(okResponse(null));
    mockUpdateSleepConfig.mockResolvedValue(okResponse({}));
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  describe("页面装配", () => {
    it("data 提供哄睡配置的默认展示值", () => {
      const page = harness.createInstance();

      expect(page.data).toMatchObject({
        deviceId: "",
        enabled: false,
        duration: "默认",
        durationMode: "default",
        durationMinutes: 15,
        content: "故事",
        contentType: "story",
        sleepTime: "21:30",
        forceSleep: false,
        guideOpen: false,
        showTimePicker: false,
        showDurationPicker: false,
      });
    });

    it("onLoad 缺少 options 时 deviceId 兜底为空串", () => {
      const page = harness.createInstance();

      page.onLoad(undefined);

      expect(page.data.deviceId).toBe("");
    });

    it("onLoad 写入 deviceId，onReady 按 deviceId 拉取配置", () => {
      const page = harness.createInstance();

      page.onLoad({ id: "dev-9" });
      page.onReady();

      expect(page.data.deviceId).toBe("dev-9");
      expect(mockGetSleepConfig).toHaveBeenCalledWith("dev-9");
    });

    it("没有 deviceId 时 onReady 不发请求", () => {
      const page = harness.createInstance();

      page.onLoad({});
      page.onReady();

      expect(mockGetSleepConfig).not.toHaveBeenCalled();
    });

    it("from=bind 标记绑定引导，完成后回我的设备列表", () => {
      const page = harness.createInstance();

      page.onLoad({ id: "dev-1", from: "bind" });

      expect(page.data.fromBind).toBe(true);

      page.onFinish();

      expect(harness.wx.switchTab).toHaveBeenCalledWith({
        url: "/pages/device-list/device-list",
      });
    });

    it("常规进入不标记绑定引导", () => {
      const page = harness.createInstance();

      page.onLoad({ id: "dev-1" });

      expect(page.data.fromBind).toBe(false);
    });
  });

  describe("加载哄睡配置", () => {
    it("手动时长模式：回填分钟数、内容与开关", async () => {
      mockGetSleepConfig.mockResolvedValue(
        okResponse({
          enabled: true,
          durationMode: "custom",
          durationMinutes: 20,
          contentType: "song",
          sleepTime: "20:30",
          forceSleep: true,
        }),
      );
      const page = harness.createInstance();

      await page.fetchSleepConfig("dev-1");

      expect(page.data).toMatchObject({
        enabled: true,
        durationMode: "custom",
        durationMinutes: 20,
        duration: "20分钟",
        contentType: "song",
        content: "儿歌",
        sleepTime: "20:30",
        forceSleep: true,
      });
    });

    it("默认时长模式：durationMinutes 为 null 时回落 15 分钟、内容类型未知时回落故事", async () => {
      mockGetSleepConfig.mockResolvedValue(
        okResponse({
          enabled: true,
          durationMode: "default",
          durationMinutes: null,
          contentType: "unknown" as never,
          sleepTime: "22:00",
          forceSleep: false,
        }),
      );
      const page = harness.createInstance();

      await page.fetchSleepConfig("dev-1");

      expect(page.data).toMatchObject({
        durationMode: "default",
        durationMinutes: 15,
        duration: "默认",
        contentType: "unknown",
        content: "故事",
        sleepTime: "22:00",
      });
    });

    it("后端未设置（data 为 null）时保留页面默认值", async () => {
      const page = harness.createInstance();

      await page.fetchSleepConfig("dev-1");

      expect(page.data).toMatchObject({
        enabled: false,
        duration: "默认",
        content: "故事",
        sleepTime: "21:30",
      });
      expect(harness.wx.showToast).not.toHaveBeenCalled();
    });

    it("加载失败提示并保留默认值", async () => {
      mockGetSleepConfig.mockRejectedValue(new Error("network"));
      const page = harness.createInstance();

      await page.fetchSleepConfig("dev-1");

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "加载失败",
        icon: "none",
      });
      expect(page.data.sleepTime).toBe("21:30");
    });
  });

  describe("保存哄睡配置", () => {
    it("没有 deviceId 时直接跳过保存", () => {
      const page = harness.createInstance();
      page.onLoad({});

      page.onToggleEnabled({ detail: true });

      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("保存失败时按 rollback 回滚本地状态", async () => {
      mockUpdateSleepConfig.mockRejectedValue(new Error("network"));
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });

      page.onToggleEnabled({ detail: true });
      await flush();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "保存失败",
        icon: "none",
      });
      expect(page.data.enabled).toBe(false);
    });

    it("未提供 rollback 时保存失败只提示不回滚", async () => {
      mockUpdateSleepConfig.mockRejectedValue(new Error("network"));
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });

      await page.saveConfig({ sleepTime: "23:00" });

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "保存失败",
        icon: "none",
      });
    });
  });

  describe("哄睡通知订阅的开关行为", () => {
    it("本页已请求过：只做静默补额", () => {
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });
      page.setData({ subscriptionAsked: true });

      page.onToggleEnabled({ detail: true });

      expect(mockRequestSubscription).not.toHaveBeenCalled();
      expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
    });

    it("尚未请求过：显式授权一次并写入本地标记", () => {
      harness.wx.getStorageSync.mockReturnValue("");
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });

      page.onToggleForce({ detail: true });

      expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
      expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
        SUBSCRIBE_ASKED_KEY,
        "1",
      );
      expect(page.data.subscriptionAsked).toBe(true);
    });
  });

  describe("「如何进入哄睡模式」展开", () => {
    it("点击标题在展开与收起之间切换", () => {
      const page = harness.createInstance();

      page.onToggleGuide();
      expect(page.data.guideOpen).toBe(true);

      page.onToggleGuide();
      expect(page.data.guideOpen).toBe(false);
    });
  });

  describe("时间设置", () => {
    it("打开弹窗时把当前时间带入临时值", () => {
      const page = harness.createInstance();

      page.onSetTime();

      expect(page.data.showTimePicker).toBe(true);
      expect(page.data.tempTime).toBe(page.data.sleepTime);
    });

    it("滚轮变化写回临时值，取消时不落库", () => {
      const page = harness.createInstance();

      page.onTimeChange({
        detail: { getValues: () => ["22", "15"] },
      });
      expect(page.data.tempTime).toBe("22:15");

      page.onCancelTime();
      expect(page.data.showTimePicker).toBe(false);
      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("滚轮返回值不完整时忽略", () => {
      const page = harness.createInstance();
      page.setData({ tempTime: "21:30" });

      page.onTimeChange({ detail: { getValues: () => ["22"] } });
      expect(page.data.tempTime).toBe("21:30");

      page.onTimeChange({ detail: { getValues: () => undefined } });
      expect(page.data.tempTime).toBe("21:30");
    });

    it("确定后保存时间并关闭弹窗", () => {
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });
      page.setData({ tempTime: "22:45" });

      page.onConfirmTime();

      expect(page.data.sleepTime).toBe("22:45");
      expect(page.data.showTimePicker).toBe(false);
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        sleepTime: "22:45",
      });
    });
  });

  describe("时长设置", () => {
    it("打开弹窗时把当前模式与分钟数带入临时值", () => {
      const page = harness.createInstance();
      page.setData({ durationMode: "custom", durationMinutes: 25 });

      page.onSetDuration();

      expect(page.data.showDurationPicker).toBe(true);
      expect(page.data.tempDurationMode).toBe("custom");
      expect(page.data.tempDurationMinutes).toBe(25);
    });

    it("切换模式与滑杆值", () => {
      const page = harness.createInstance();

      page.onSelectDurationMode({
        currentTarget: { dataset: { mode: "custom" } },
      });
      expect(page.data.tempDurationMode).toBe("custom");

      page.onDurationSlideChange({ detail: 30 });
      expect(page.data.tempDurationMinutes).toBe(30);
    });

    it("取消不落库", () => {
      const page = harness.createInstance();

      page.onCancelDuration();

      expect(page.data.showDurationPicker).toBe(false);
      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("手动模式确定：文案按分钟数渲染并保存 custom", () => {
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });
      page.setData({ tempDurationMode: "custom", tempDurationMinutes: 25 });

      page.onConfirmDuration();

      expect(page.data.duration).toBe("25分钟");
      expect(page.data.durationMode).toBe("custom");
      expect(page.data.durationMinutes).toBe(25);
      expect(page.data.showDurationPicker).toBe(false);
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        durationMode: "custom",
        durationMinutes: 25,
      });
    });

    it("默认模式确定：文案回落「默认」并只保存模式", () => {
      const page = harness.createInstance();
      page.onLoad({ id: "dev-1" });
      page.setData({ tempDurationMode: "default", tempDurationMinutes: 20 });

      page.onConfirmDuration();

      expect(page.data.duration).toBe("默认");
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        durationMode: "default",
      });
    });
  });

  describe("内容设置", () => {
    it("选择内容暂为占位提示", () => {
      const page = harness.createInstance();

      page.onChooseContent();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "功能开发中，敬请期待",
        icon: "none",
      });
    });
  });
});
