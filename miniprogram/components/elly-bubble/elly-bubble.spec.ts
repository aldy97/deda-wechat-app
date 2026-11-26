/**
 * elly-bubble 组件契约测试。
 *
 * 孩子信息页与哄睡设置页的页头「Elly + 对话气泡」只有这一份实现：
 * 文案由调用方按行传入，吉祥物走 elly-image 远端展示位，
 * 气泡视觉（含半透明底色）只在本组件 wxss 里维护。
 */
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const read = (name: string): string =>
  fs.readFileSync(path.join(__dirname, name), "utf8");

const harness = installComponentHarness();

describe("elly-bubble 组件契约", () => {
  beforeAll(() => {
    require("./elly-bubble");
  });

  it("默认无文案：调用方不传 lines 时不渲染气泡体", () => {
    const instance = harness.createInstance();

    expect(instance.data.lines).toEqual([]);
  });

  it("wxml 用 elly-image 承载吉祥物，展示位与兜底图为静态字面量", () => {
    const wxml = read("elly-bubble.wxml");
    const tag = /<elly-image\b([^>]*)>/.exec(wxml)?.[1] ?? "";

    expect(tag).toContain('asset-key="owner-info/mascot"');
    expect(tag).toContain('fallback="/static/images/kid-info/logo.png"');
    expect(tag).toContain('mode="aspectFit"');
  });

  it("逐行渲染文案，空文案不渲染气泡体", () => {
    const wxml = read("elly-bubble.wxml");

    expect(wxml).toContain('wx:for="{{ lines }}"');
    expect(wxml).toMatch(/wx:if="\{\{\s*lines\.length\s*\}\}"/);
  });

  it("json 注册 elly-image 子组件", () => {
    const config = JSON.parse(read("elly-bubble.json"));

    expect(config.component).toBe(true);
    expect(config.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it("气泡底色只有一次合成：同色边框与旋转方块都不得再出现", () => {
    const wxss = read("elly-bubble.wxss");

    expect(wxss).toContain("var(--color-kid-bubble)");
    expect(wxss).not.toContain("rotate(45deg)");
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(wxss).not.toMatch(
      /border\s*:\s*[^;]*var\(--color-kid-bubble\)[^;]*;/,
    );
  });
});
