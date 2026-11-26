/**
 * sleep-config-form 组件契约测试。
 *
 * 哄睡配置表单只有这一份实现：首次绑定引导页（sleep-manage）与后续修改页
 * （sleep-config）都只装配本组件。覆盖口径：默认值、deviceId 装配、
 * 配置加载与保存、时间与时长弹窗的临时值/确定回写、引导展开、内容占位提示、
 * 以及哄睡通知订阅（首次显式授权、之后静默补额，且不阻塞保存）。
 */
import { getSleepConfig, updateSleepConfig } from "../../api/api";
import {
  requestSleepReminderSubscription,
  silentTopUpSleepReminder,
} from "../../utils/push-subscription";
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

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

describe("sleep-config-form 组件", () => {
  const harness = installComponentHarness();

  beforeAll(() => {
    require("./sleep-config-form");
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

  /** 创建实例并模拟小程序 attached 生命周期 */
  function attach(deviceId = "dev-1") {
    const instance = harness.createInstance({ deviceId });
    instance.lifetimes.attached();
    return instance;
  }

  describe("组件装配", () => {
    it("data 提供哄睡配置的默认展示值", () => {
      const instance = harness.createInstance();

      expect(instance.data).toMatchObject({
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

    it("有 deviceId：attached 后拉取该设备的配置", () => {
      const instance = attach("dev-9");

      expect(instance.data.deviceId).toBe("dev-9");
      expect(mockGetSleepConfig).toHaveBeenCalledWith("dev-9");
    });

    it("没有 deviceId：不发请求，保留默认值", () => {
      const instance = harness.createInstance();
      instance.lifetimes.attached();

      expect(mockGetSleepConfig).not.toHaveBeenCalled();
      expect(instance.data.sleepTime).toBe("21:30");
    });

    it("deviceId 晚到（attached 时为空）：属性更新后补拉一次", async () => {
      const instance = harness.createInstance();
      instance.lifetimes.attached();
      expect(mockGetSleepConfig).not.toHaveBeenCalled();

      instance.data.deviceId = "dev-late";
      instance.observers.deviceId("dev-late");
      await flush();

      expect(mockGetSleepConfig).toHaveBeenCalledTimes(1);
      expect(mockGetSleepConfig).toHaveBeenCalledWith("dev-late");
    });

    it("同一 deviceId 重复触发（show / observer）：只拉一次", async () => {
      const instance = attach("dev-1");
      await flush();

      instance.pageLifetimes.show();
      instance.observers.deviceId("dev-1");
      await flush();

      expect(mockGetSleepConfig).toHaveBeenCalledTimes(1);
    });

    it("上次加载失败：回到页面 show 时重试", async () => {
      mockGetSleepConfig.mockRejectedValueOnce(new Error("network"));
      const instance = attach("dev-1");
      await flush();
      expect(mockGetSleepConfig).toHaveBeenCalledTimes(1);

      instance.pageLifetimes.show();
      await flush();

      expect(mockGetSleepConfig).toHaveBeenCalledTimes(2);
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
      const instance = harness.createInstance({ deviceId: "dev-1" });

      await instance.fetchSleepConfig("dev-1");

      expect(instance.data).toMatchObject({
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
      const instance = harness.createInstance({ deviceId: "dev-1" });

      await instance.fetchSleepConfig("dev-1");

      expect(instance.data).toMatchObject({
        durationMode: "default",
        durationMinutes: 15,
        duration: "默认",
        contentType: "unknown",
        content: "故事",
        sleepTime: "22:00",
      });
    });

    it("后端未设置（data 为 null）时保留页面默认值", async () => {
      const instance = harness.createInstance({ deviceId: "dev-1" });

      await instance.fetchSleepConfig("dev-1");

      expect(instance.data).toMatchObject({
        enabled: false,
        duration: "默认",
        content: "故事",
        sleepTime: "21:30",
      });
      expect(harness.wx.showToast).not.toHaveBeenCalled();
    });

    it("加载失败提示并保留默认值", async () => {
      mockGetSleepConfig.mockRejectedValue(new Error("network"));
      const instance = harness.createInstance({ deviceId: "dev-1" });

      await instance.fetchSleepConfig("dev-1");

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "加载失败",
        icon: "none",
      });
      expect(instance.data.sleepTime).toBe("21:30");
    });
  });

  describe("保存哄睡配置", () => {
    it("没有 deviceId 时直接跳过保存", () => {
      const instance = harness.createInstance();

      instance.onToggleEnabled({ detail: true });

      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("保存失败时按 rollback 回滚本地状态", async () => {
      mockUpdateSleepConfig.mockRejectedValue(new Error("network"));
      const instance = attach("dev-1");

      instance.onToggleEnabled({ detail: true });
      await flush();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "保存失败",
        icon: "none",
      });
      expect(instance.data.enabled).toBe(false);
    });

    it("未提供 rollback 时保存失败只提示不回滚", async () => {
      mockUpdateSleepConfig.mockRejectedValue(new Error("network"));
      const instance = attach("dev-1");

      await instance.saveConfig({ sleepTime: "23:00" });

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "保存失败",
        icon: "none",
      });
    });
  });

  describe("哄睡通知订阅的开关行为", () => {
    it("本实例已请求过：只做静默补额", () => {
      const instance = attach("dev-1");
      instance.setData({ subscriptionAsked: true });

      instance.onToggleEnabled({ detail: true });

      expect(mockRequestSubscription).not.toHaveBeenCalled();
      expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
    });

    it("尚未请求过：显式授权一次并写入本地标记", () => {
      harness.wx.getStorageSync.mockReturnValue("");
      const instance = attach("dev-1");

      instance.onToggleForce({ detail: true });

      expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
      expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
        SUBSCRIBE_ASKED_KEY,
        "1",
      );
      expect(instance.data.subscriptionAsked).toBe(true);
    });

    it("本地已标记过（storage 有值）：静默补额、不显式弹窗", () => {
      harness.wx.getStorageSync.mockImplementation((key: string) =>
        key === SUBSCRIBE_ASKED_KEY ? "1" : "",
      );
      const instance = attach("dev-1");

      instance.onToggleEnabled({ detail: true });

      expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
      expect(mockRequestSubscription).not.toHaveBeenCalled();
    });

    it("同实例第二次操作：转为静默补额，不再显式弹窗", () => {
      harness.wx.getStorageSync.mockReturnValue("");
      const instance = attach("dev-1");

      instance.onToggleEnabled({ detail: true });
      instance.onToggleForce({ detail: true });

      expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
      expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["onToggleForce", () => ({ detail: true })],
      ["onConfirmTime", () => undefined],
      ["onConfirmDuration", () => undefined],
    ])("%s 同样触发订阅请求", (handlerName, makeEvent) => {
      harness.wx.getStorageSync.mockReturnValue("");
      const instance = attach("dev-1");

      const event = makeEvent();
      instance[handlerName](event);

      expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
    });

    it("授权结果不阻塞保存：拒绝授权后配置仍正常提交", async () => {
      harness.wx.getStorageSync.mockReturnValue("");
      mockRequestSubscription.mockResolvedValueOnce("reject");
      const instance = attach("dev-1");

      instance.onToggleEnabled({ detail: true });
      await flush();

      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        enabled: true,
      });
    });
  });

  describe("「如何进入哄睡模式」卡片（暂停展示）", () => {
    it("wxml 已整块注释，渲染层不再出现卡片", () => {
      const wxml: string = fs.readFileSync(
        path.join(__dirname, "sleep-config-form.wxml"),
        "utf8",
      );
      const visible = wxml.replace(/<!--[\s\S]*?-->/g, "");

      expect(visible).not.toContain('class="guide-card"');
      expect(visible).not.toContain("如何进入哄睡模式");
      // 代码仍保留在注释里，恢复时无需重写
      expect(wxml).toContain('class="guide-card"');
    });

    it("展开状态与方法保留，恢复卡片后即可直接用", () => {
      const instance = harness.createInstance();

      instance.onToggleGuide();
      expect(instance.data.guideOpen).toBe(true);

      instance.onToggleGuide();
      expect(instance.data.guideOpen).toBe(false);
    });
  });

  describe("时间设置", () => {
    it("打开弹窗时把当前时间带入临时值", () => {
      const instance = harness.createInstance();

      instance.onSetTime();

      expect(instance.data.showTimePicker).toBe(true);
      expect(instance.data.tempTime).toBe(instance.data.sleepTime);
    });

    it("滚轮变化写回临时值，取消时不落库", () => {
      const instance = harness.createInstance();

      instance.onTimeChange({
        detail: { getValues: () => ["22", "15"] },
      });
      expect(instance.data.tempTime).toBe("22:15");

      instance.onCancelTime();
      expect(instance.data.showTimePicker).toBe(false);
      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("滚轮返回值不完整时忽略", () => {
      const instance = harness.createInstance();
      instance.setData({ tempTime: "21:30" });

      instance.onTimeChange({ detail: { getValues: () => ["22"] } });
      expect(instance.data.tempTime).toBe("21:30");

      instance.onTimeChange({ detail: { getValues: () => undefined } });
      expect(instance.data.tempTime).toBe("21:30");
    });

    it("确定后保存时间并关闭弹窗", () => {
      const instance = attach("dev-1");
      instance.setData({ tempTime: "22:45" });

      instance.onConfirmTime();

      expect(instance.data.sleepTime).toBe("22:45");
      expect(instance.data.showTimePicker).toBe(false);
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        sleepTime: "22:45",
      });
    });
  });

  describe("时长设置", () => {
    it("打开弹窗时把当前模式与分钟数带入临时值", () => {
      const instance = harness.createInstance();
      instance.setData({ durationMode: "custom", durationMinutes: 25 });

      instance.onSetDuration();

      expect(instance.data.showDurationPicker).toBe(true);
      expect(instance.data.tempDurationMode).toBe("custom");
      expect(instance.data.tempDurationMinutes).toBe(25);
    });

    it("切换模式与滑杆值", () => {
      const instance = harness.createInstance();

      instance.onSelectDurationMode({
        currentTarget: { dataset: { mode: "custom" } },
      });
      expect(instance.data.tempDurationMode).toBe("custom");

      instance.onDurationSlideChange({ detail: 30 });
      expect(instance.data.tempDurationMinutes).toBe(30);
    });

    it("取消不落库", () => {
      const instance = harness.createInstance();

      instance.onCancelDuration();

      expect(instance.data.showDurationPicker).toBe(false);
      expect(mockUpdateSleepConfig).not.toHaveBeenCalled();
    });

    it("手动模式确定：文案按分钟数渲染并保存 custom", () => {
      const instance = attach("dev-1");
      instance.setData({ tempDurationMode: "custom", tempDurationMinutes: 25 });

      instance.onConfirmDuration();

      expect(instance.data.duration).toBe("25分钟");
      expect(instance.data.durationMode).toBe("custom");
      expect(instance.data.durationMinutes).toBe(25);
      expect(instance.data.showDurationPicker).toBe(false);
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        durationMode: "custom",
        durationMinutes: 25,
      });
    });

    it("默认模式确定：文案回落「默认」并只保存模式", () => {
      const instance = attach("dev-1");
      instance.setData({
        tempDurationMode: "default",
        tempDurationMinutes: 20,
      });

      instance.onConfirmDuration();

      expect(instance.data.duration).toBe("默认");
      expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
        durationMode: "default",
      });
    });
  });

  describe("内容设置", () => {
    it("选择内容暂为占位提示", () => {
      const instance = harness.createInstance();

      instance.onChooseContent();

      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "功能开发中，敬请期待",
        icon: "none",
      });
    });
  });
});
