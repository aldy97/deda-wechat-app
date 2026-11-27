/**
 * science-banner 组件契约：title / tone 透传、点击抛 open、GO 徽标与双色调只走色板。
 *
 * 睡前的粉色调与冒险故事的森林绿色调共用同一套布局：胶囊容器、左侧标题、
 * 右侧 GO 圆形徽标；颜色差异只由 tone 修饰类切换色板变量。
 */
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installComponentHarness();

require("./science-banner");

function read(relative: string): string {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

describe("science-banner 组件", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("默认 tone=sleep，title 透传", () => {
    const instance = harness.createInstance({
      title: "了解更多哄睡的科学原理",
    });

    expect(instance.data.title).toBe("了解更多哄睡的科学原理");
    expect(instance.data.tone).toBe("sleep");
  });

  it("点击根节点触发 open 事件", () => {
    const instance = harness.createInstance({
      title: "了解更多冒险故事的科学原理",
      tone: "adventure",
    });

    instance.onTap();

    expect(instance.triggerEvent).toHaveBeenCalledWith("open");
  });

  it("WXML 渲染 title、GO 徽标与 tone 主类", () => {
    const wxml: string = read("science-banner.wxml");

    expect(wxml).toContain("{{ title }}");
    expect(wxml).toContain("science-banner--{{ tone }}");
    expect(wxml).toContain("GO");
    expect(wxml).toContain('bind:tap="onTap"');
    expect(wxml).toContain('aria-role="button"');
    expect(wxml).toContain('aria-label="{{ title }}"');
  });

  it("两种色调都只走色板变量", () => {
    const wxss: string = read("science-banner.wxss");

    for (const token of [
      "--color-sleep-science-start",
      "--color-sleep-science-end",
      "--color-sleep-science-badge",
      "--color-sleep-science-badge-text",
      "--color-adventure-science-start",
      "--color-adventure-science-end",
      "--color-adventure-science-badge",
      "--color-adventure-science-badge-text",
    ]) {
      expect(wxss).toContain(`var(${token})`);
    }
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
