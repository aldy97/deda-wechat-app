/**
 * device-control 页面结构 guard。
 * 导航栏已经展示「音量控制」，页面内不再重复标题；
 * 音量主控件必须是居中卡片（标签 + 大数值 + 10 格刻度），防止视觉回归。
 */
const fs = require("fs");
const path = require("path");

declare const __dirname: string;

const WXML = fs.readFileSync(
  path.join(__dirname, "../pages/device-control/device-control.wxml"),
  "utf-8",
);

describe("device-control 页面结构", () => {
  it("不再渲染页面级「音量控制」标题与对话模式", () => {
    expect(WXML).not.toContain("page-title");
    expect(WXML).not.toContain("当前对话模式");
  });

  it("音量主控件使用居中卡片、标签与刻度", () => {
    expect(WXML).toContain("volume-card");
    expect(WXML).toContain("volume-label");
    expect(WXML).toContain("volume-meter");
    expect(WXML).toContain("volume-status");
  });

  it("保留离线提示与控制按钮", () => {
    expect(WXML).toContain("statusHint");
    expect(WXML).toContain("onRefresh");
  });
});

export {};
