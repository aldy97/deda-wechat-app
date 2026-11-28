/**
 * expand-arrow 组件契约：CSS 画的 V 形展开箭头，open 切换时按 transform 过渡
 * 做 180° 反转，不占图标资源、不需要两套图片。
 */
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installComponentHarness();

require("./expand-arrow");

function read(relative: string): string {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

describe("expand-arrow 组件", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("默认收起；尺寸与描边宽度由属性传入", () => {
    const instance = harness.createInstance({ size: 12, weight: 3 });

    expect(instance.data.open).toBe(false);
    expect(instance.data.size).toBe(12);
    expect(instance.data.weight).toBe(3);
  });

  it("wxml：开合挂修饰类，尺寸与描边走内联样式，纯装饰不朗读", () => {
    const wxml = read("expand-arrow.wxml");

    expect(wxml).toContain("expand-arrow {{ open ? 'expand-arrow--open' : '' }}");
    expect(wxml).toContain("width: {{ size }}rpx");
    expect(wxml).toContain("height: {{ size }}rpx");
    expect(wxml).toContain("border-width: 0 {{ weight }}rpx {{ weight }}rpx 0");
    expect(wxml).toContain('aria-hidden="true"');
  });

  it("wxss：靠 transform 过渡反转，收起 V 朝下、展开 V 朝上", () => {
    const wxss = read("expand-arrow.wxss");

    expect(wxss).toContain("transition: transform");
    expect(wxss).toContain("border-color: currentColor");
    expect(wxss).toMatch(/\.expand-arrow\s*\{[^}]*rotate\(45deg\)/);
    expect(wxss).toMatch(/\.expand-arrow--open\s*\{[^}]*rotate\(225deg\)/);
  });

  it("减弱动态效果时不做动画", () => {
    const wxss = read("expand-arrow.wxss");

    expect(wxss).toContain("prefers-reduced-motion");
    expect(wxss).toContain("transition: none");
  });

  it("声明为自定义组件", () => {
    const config = JSON.parse(read("expand-arrow.json"));

    expect(config.component).toBe(true);
  });
});
