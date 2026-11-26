/**
 * 设备列表导航栏与单卡展示 guard（静态层）。
 *
 * 首页不再有「我的设备」标题；多设备时导航栏左侧是共享 dropdown + 添加设备按钮；
 * 设备卡片只渲染当前选中的孩子；哄睡入口按选中设备进入配置页。
 */
export {};

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const PAGE = "pages/device-list/device-list";

const wxml: string = read(`${PAGE}.wxml`);
const wxss: string = read(`${PAGE}.wxss`);
const ts: string = read(`${PAGE}.ts`);
const json = JSON.parse(read(`${PAGE}.json`));

function read(relative: string): string {
  return fs.readFileSync(path.join(MINIPROGRAM_ROOT, relative), "utf8");
}

function rule(selector: string): string {
  const match = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(wxss);
  return match ? match[1] : "";
}

function declaration(body: string, property: string): string {
  const match = new RegExp(`(?:^|\\s)${property}:\\s*([^;]+);`).exec(body);
  return match ? match[1].trim() : "";
}

describe("设备列表导航与单卡展示", () => {
  it("导航栏不再渲染「我的设备」标题", () => {
    const navStart = wxml.indexOf('class="device-nav"');
    const navEnd = wxml.indexOf('class="container"');
    const nav = wxml.slice(navStart, navEnd);

    expect(navStart).toBeGreaterThan(-1);
    expect(nav).not.toContain("device-nav-title");
    expect(nav).not.toContain("我的设备");
    expect(wxss).not.toContain(".device-nav-title");
  });

  it("dropdown 只在多设备时出现，且排在添加设备按钮左侧", () => {
    const navStart = wxml.indexOf('class="device-nav"');
    const navEnd = wxml.indexOf('class="container"');
    const nav = wxml.slice(navStart, navEnd);
    const dropdownIndex = nav.indexOf("<device-switch-dropdown");
    const fabIndex = nav.indexOf('class="add-device-fab"');

    expect(dropdownIndex).toBeGreaterThan(-1);
    expect(fabIndex).toBeGreaterThan(dropdownIndex);
    expect(nav).toMatch(
      /<device-switch-dropdown[^>]*wx:if="\{\{\s*devices\.length > 1\s*\}\}"/,
    );
    expect(nav).toContain('variant="nav"');
    expect(nav).toContain('bind:change="onDeviceChange"');
  });

  it("页面 json 注册共享 dropdown 组件", () => {
    expect(json.usingComponents["device-switch-dropdown"]).toBe(
      "/components/device-switch-dropdown/device-switch-dropdown",
    );
  });

  it("设备卡片只渲染选中的孩子，不再遍历整个设备列表", () => {
    expect(wxml).not.toContain('wx:for="{{ devices }}"');
    expect(wxml).toContain("selectedDevice");
    expect(wxml).not.toMatch(/\bitem\.(statusLabel|cardTitle|childProfile)\b/);
  });

  it("哄睡入口按当前选中设备进入配置页", () => {
    const start = ts.indexOf("onSleepManageTap");
    const section = ts.slice(start, start + 500);

    expect(start).toBeGreaterThan(-1);
    expect(section).toContain("selectedDevice");
    expect(section).not.toContain("devices[0]");
    expect(section).toContain("/pages/sleep-config/sleep-config");
  });

  it("哄睡入口卡改为与来信 banner 同款浅色渐变", () => {
    const hero = rule(".sleep-manage-hero");

    expect(declaration(hero, "background")).toContain(
      "var(--color-mode-5-soft)",
    );
    expect(declaration(hero, "background")).toContain("var(--color-surface)");
    expect(hero).not.toContain("--color-sleep-deep");
    expect(declaration(rule(".sleep-manage-hero__title"), "color")).toBe(
      "var(--color-heading)",
    );
    expect(declaration(rule(".sleep-manage-hero__subtitle"), "color")).toBe(
      "var(--color-mode-5)",
    );
  });
});
