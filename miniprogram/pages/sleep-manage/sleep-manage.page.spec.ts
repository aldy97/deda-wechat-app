/**
 * sleep-manage 页面装配测试（onboarding 专用薄页面）。
 *
 * 配置表单已抽到 components/sleep-config-form（组件契约由该目录 spec 锁定），
 * 本页只锁定：deviceId 透传、fromBind 门控、气泡文案、完成入口。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

const read = (name: string): string =>
  fs.readFileSync(path.join(__dirname, name), "utf8");

describe("sleep-manage 页面装配", () => {
  let page: any;

  beforeAll(() => {
    require("./sleep-manage");
  });

  beforeEach(() => {
    page = harness.createInstance();
  });

  it("data 默认值：未进入绑定流程、deviceId 为空", () => {
    expect(page.data).toMatchObject({
      deviceId: "",
      fromBind: false,
    });
  });

  it("onLoad 缺少 options 时 deviceId 兜底为空串", () => {
    page.onLoad(undefined);

    expect(page.data.deviceId).toBe("");
    expect(page.data.fromBind).toBe(false);
  });

  it("onLoad 写入 deviceId 并识别绑定引导", () => {
    page.onLoad({ id: "dev-9", from: "bind" });

    expect(page.data.deviceId).toBe("dev-9");
    expect(page.data.fromBind).toBe(true);
  });

  it("常规进入不标记绑定引导", () => {
    page.onLoad({ id: "dev-1" });

    expect(page.data.fromBind).toBe(false);
  });

  it("绑定引导完成：回我的设备列表", () => {
    page.onLoad({ id: "dev-1", from: "bind" });

    page.onFinish();

    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });

  it("页头气泡文案两条，与孩子信息页共用 elly-bubble 组件", () => {
    expect(page.data.bubbleLines).toHaveLength(2);
    expect(page.data.bubbleLines[0]).toContain("请设置宝贝的常规睡眠时间吧");
    expect(page.data.bubbleLines[1]).toContain("陪伴宝贝慢慢入睡");
  });

  it("wxml 把 deviceId 透传给共享表单组件，不再自带表单结构", () => {
    const wxml = read("sleep-manage.wxml");

    expect(wxml).toContain("<sleep-config-form");
    expect(wxml).toContain('device-id="{{ deviceId }}"');
    expect(wxml).not.toContain("<van-switch");
    expect(wxml).not.toContain("<van-popup");
    expect(wxml).not.toContain("duration-panel");
  });

  it("json 注册共享表单组件", () => {
    const config = JSON.parse(read("sleep-manage.json"));

    expect(config.usingComponents["sleep-config-form"]).toBe(
      "/components/sleep-config-form/sleep-config-form",
    );
  });
});
