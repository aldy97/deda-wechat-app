/**
 * 设备列表导航栏与单卡展示 guard（静态层）。
 *
 * 首页不再有「我的设备」标题；导航栏左侧是常驻的共享 dropdown（切换孩子 + 添加设备）；
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

  it("dropdown 常驻导航栏，切换孩子与「添加设备」都收在同一个菜单里", () => {
    const navStart = wxml.indexOf('class="device-nav"');
    const navEnd = wxml.indexOf('class="container"');
    const nav = wxml.slice(navStart, navEnd);
    const dropdownIndex = nav.indexOf("<device-switch-dropdown");
    const tag = /<device-switch-dropdown\b([^>]*)>/.exec(nav);

    expect(dropdownIndex).toBeGreaterThan(-1);
    expect(tag).not.toBeNull();
    // 常驻：单设备 / 无设备时也要能进来添加设备
    expect(nav).not.toMatch(/<device-switch-dropdown[^>]*wx:if=/);
    expect(nav).toContain('addable="{{ true }}"');
    expect(nav).toContain('selected-gender="{{ selectedDeviceGender }}"');
    // 胶囊贴在屏幕左侧，菜单必须向左锚定，否则 264rpx 的菜单会被推出屏幕
    expect(nav).toContain('menu-align="left"');
    expect(nav).toContain('bind:change="onDeviceChange"');
    expect(nav).toContain('bind:add="onAddDevice"');
    // 独立的圆形「+」按钮已下线，入口移到菜单底部
    expect(nav).not.toContain('class="add-device-fab"');
    expect(wxss).not.toContain(".add-device-fab");
    // 两处调用共用同一套胶囊尺寸，不再有导航栏变体
    expect(nav).not.toContain('variant="nav"');
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

  it("哄睡入口卡使用深蓝渐变，前景用配套浅色", () => {
    const hero = rule(".sleep-manage-hero");
    const background = declaration(hero, "background");

    expect(background).toContain("linear-gradient");
    expect(background).toContain("135deg");
    expect(background).toContain("var(--color-sleep-card-start)");
    expect(background).toContain("var(--color-sleep-card-end)");
    expect(background).not.toContain("var(--color-mode-5-soft)");
    expect(declaration(rule(".sleep-manage-hero__title"), "color")).toBe(
      "var(--color-sleep-title)",
    );
    expect(declaration(rule(".sleep-manage-hero__subtitle"), "color")).toBe(
      "var(--color-sleep-card-subtitle)",
    );
  });

  it("顶栏 logo 水平居中于刘海中线，尺寸与去掉了的「+」按钮一致", () => {
    const logo = /<image\b[^>]*class="device-nav-logo"[^>]*>/.exec(wxml);
    const logoIndex = wxml.indexOf('class="device-nav-logo"');
    const dropdownIndex = wxml.indexOf("<device-switch-dropdown");

    expect(logo).not.toBeNull();
    expect((logo as RegExpExecArray)[0]).toContain(
      'src="/static/images/kid-info/logo.png"',
    );
    expect(logoIndex).toBeGreaterThan(-1);
    expect(logoIndex).toBeLessThan(dropdownIndex);

    const logoRule = rule(".device-nav-logo");

    expect(declaration(rule(".device-nav-bar"), "align-items")).toBe("center");
    expect(declaration(logoRule, "position")).toBe("absolute");
    expect(declaration(logoRule, "left")).toBe("50%");
    expect(declaration(logoRule, "top")).toBe("calc(50% - 3rpx)");
    expect(declaration(logoRule, "transform")).toBe("translate(-50%, -50%)");
    expect(declaration(logoRule, "width")).toBe("64rpx");
    expect(declaration(logoRule, "height")).toBe("64rpx");
    expect(
      fs.existsSync(
        path.join(MINIPROGRAM_ROOT, "static/images/kid-info/logo.png"),
      ),
    ).toBe(true);
  });
});
