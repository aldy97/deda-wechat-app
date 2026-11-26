/**
 * sleep-config 页面装配测试。
 *
 * 配置表单由 components/sleep-config-form 承载（契约在该目录 spec），
 * 本页只锁定：deviceId 装配与缺失兜底、hero 标签数据、模板接线。
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

  it("data 提供空 deviceId 与三个哄睡能力标签（不含自动熄屏）", () => {
    expect(page.data.deviceId).toBe("");
    expect(page.data.heroTags).toEqual([
      "心理共鸣",
      "Kid Affirmation",
      "脑波调节",
    ]);
  });

  it("onLoad 写入 deviceId", () => {
    page.onLoad({ id: "dev-9" });

    expect(page.data.deviceId).toBe("dev-9");
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

  it("wxml 把 deviceId 透传给共享表单组件", () => {
    const wxml = read("sleep-config.wxml");

    expect(wxml).toContain("<sleep-config-form");
    expect(wxml).toContain('device-id="{{ deviceId }}"');
  });

  it("hero 与科学原理 banner 均为纯展示，不挂点击事件", () => {
    const wxml = read("sleep-config.wxml");

    expect(wxml).not.toContain("bind:tap");
    expect(wxml).not.toContain("catch:");
    expect(wxml).not.toContain("<navigator");
    expect(wxml).not.toContain("aria-role");
  });

  it("json 注册背景图、共享表单与渐变底", () => {
    const config = JSON.parse(read("sleep-config.json"));

    expect(config.navigationBarTitleText).toBe("哄睡配置");
    expect(config.usingComponents["elly-image"]).toBe(
      "/components/elly-image/elly-image",
    );
    expect(config.usingComponents["sleep-config-form"]).toBe(
      "/components/sleep-config-form/sleep-config-form",
    );
    expect(config.usingComponents["kid-gradient-bg"]).toContain(
      "components/kid-gradient-bg/kid-gradient-bg",
    );
  });
});
