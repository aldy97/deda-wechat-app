/**
 * sleep-config 页面装配测试：科学原理 banner 的导航目标、onLoad 参数兜底、
 * hero 高度换算与返回键降级。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

require("./sleep-config");

function read(relative: string): string {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

describe("sleep-config page 装配", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("点击科学原理 banner 进入晚安故事模式介绍页", () => {
    const page = harness.createInstance();

    page.onOpenScience();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/night-story-intro/night-story-intro",
    });
  });

  it("onLoad 注入 deviceId 并按胶囊位置算导航栏高度", () => {
    const page = harness.createInstance();

    page.onLoad({ id: "dev-1" });

    expect(page.data.deviceId).toBe("dev-1");
    expect(page.data.statusBarHeight).toBe(20);
    expect(page.data.navBarHeight).toBe(44);
  });

  it("缺少设备 id 时提示但不抛错", () => {
    const page = harness.createInstance();

    page.onLoad(undefined);

    expect(page.data.deviceId).toBe("");
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "缺少设备信息",
      icon: "none",
    });
  });

  it("hero 高度按背景图原始比例换算（750rpx 宽）", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad({ detail: { width: 750, height: 500 } });

    expect(page.data.heroHeight).toBe(500);
  });

  it("背景图尺寸缺失或比例相等时保持兜底高度", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad({ detail: {} });
    expect(page.data.heroHeight).toBe(440);

    page.onHeroImageLoad({ detail: { width: 750, height: 440 } });
    expect(page.data.heroHeight).toBe(440);
  });

  it("背景图缺失：监听 unavailable 并把 hero 收窄，不再留 440rpx 空白", () => {
    const page = harness.createInstance();
    const wxml: string = read("sleep-config.wxml");

    expect(wxml).toContain('bind:unavailable="onHeroUnavailable"');

    page.onHeroUnavailable();

    expect(page.data.heroHeight).toBe(240);
  });

  it("返回失败时降级到设备列表", () => {
    harness.wx.navigateBack.mockImplementationOnce((options: any) => {
      options.fail();
    });
    const page = harness.createInstance();

    page.onBack();

    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });
});
