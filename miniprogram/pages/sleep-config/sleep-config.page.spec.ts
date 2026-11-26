/**
 * sleep-config 页面装配测试。
 *
 * 配置表单由 components/sleep-config-form 承载（契约在该目录 spec），
 * 本页只锁定：deviceId 装配与缺失兜底、自定义导航栏尺寸、返回行为、
 * hero 标签数据、模板接线。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

const read = (name: string): string =>
  fs.readFileSync(path.join(__dirname, name), "utf8");

describe("sleep-config 页面装配", () => {
  let page: any;

  beforeAll(() => {
    require("./sleep-config");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
  });

  it("data 提供空 deviceId、三个能力标签与导航栏兜底尺寸", () => {
    expect(page.data.deviceId).toBe("");
    expect(page.data.heroTags).toEqual([
      "心理共鸣",
      "Kid Affirmation",
      "脑波调节",
    ]);
    expect(page.data.statusBarHeight).toBe(20);
    expect(page.data.navBarHeight).toBe(44);
    expect(page.data.heroHeight).toBe(440);
  });

  it("背景图加载完成：按原始宽高比换算 hero 高度", () => {
    page.onHeroImageLoad({ detail: { width: 1080, height: 640 } });

    // 750 * 640 / 1080 = 444.4 → 444
    expect(page.data.heroHeight).toBe(444);
  });

  it("背景图尺寸缺失或为 0：保留兜底高度", () => {
    page.onHeroImageLoad(undefined as never);
    page.onHeroImageLoad({ detail: { width: 0, height: 640 } });
    page.onHeroImageLoad({ detail: { width: 1080, height: 0 } });

    expect(page.data.heroHeight).toBe(440);
  });

  it("onLoad 写入 deviceId 并按胶囊按钮计算导航栏尺寸", () => {
    harness.wx.getWindowInfo.mockReturnValueOnce({ statusBarHeight: 24 });
    harness.wx.getMenuButtonBoundingClientRect.mockReturnValueOnce({
      top: 28,
      height: 30,
    });

    page.onLoad({ id: "dev-9" });

    // (28 - 24) * 2 + 30 = 38
    expect(page.data.deviceId).toBe("dev-9");
    expect(page.data.statusBarHeight).toBe(24);
    expect(page.data.navBarHeight).toBe(38);
    expect(harness.wx.showToast).not.toHaveBeenCalled();
  });

  it("onLoad 缺少 options 时 deviceId 兜底为空串并提示", () => {
    page.onLoad(undefined);

    expect(page.data.deviceId).toBe("");
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "缺少设备信息",
      icon: "none",
    });
  });

  it("返回键：有页面栈时 navigateBack", () => {
    page.onBack();

    expect(harness.wx.navigateBack).toHaveBeenCalledTimes(1);
    expect(harness.wx.switchTab).not.toHaveBeenCalled();
  });

  it("返回键：无页面栈时回设备列表", () => {
    page.onBack();

    const options = harness.wx.navigateBack.mock.calls[0][0];
    options.fail();

    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });

  it("wxml 把 deviceId 透传给共享表单组件", () => {
    const wxml = read("sleep-config.wxml");

    expect(wxml).toContain("<sleep-config-form");
    expect(wxml).toContain('device-id="{{ deviceId }}"');
  });

  it("hero 内容与科学原理 banner 均不可点，唯一交互是返回键", () => {
    const wxml = read("sleep-config.wxml");
    const bannerStart = wxml.indexOf('class="science-banner"');
    const bannerEnd = wxml.indexOf('class="sleep-config-body"');
    const banner = wxml.slice(bannerStart, bannerEnd);

    expect(wxml.match(/bind:tap/g)).toHaveLength(1);
    expect(wxml).toContain('bind:tap="onBack"');
    expect(banner).not.toContain("bind:tap");
    expect(banner).not.toContain("<navigator");
  });

  it("json 关闭系统导航栏、不再配置标题，并注册所需组件", () => {
    const config = JSON.parse(read("sleep-config.json"));

    expect(config.navigationStyle).toBe("custom");
    expect(config.navigationBarTitleText).toBeUndefined();
    expect(config.usingComponents["elly-image"]).toBe(
      "/components/elly-image/elly-image",
    );
    expect(config.usingComponents["sleep-config-form"]).toBe(
      "/components/sleep-config-form/sleep-config-form",
    );
    expect(config.usingComponents["van-icon"]).toContain(
      "@vant/weapp/icon/index",
    );
    expect(config.usingComponents["kid-gradient-bg"]).toContain(
      "components/kid-gradient-bg/kid-gradient-bg",
    );
  });
});
