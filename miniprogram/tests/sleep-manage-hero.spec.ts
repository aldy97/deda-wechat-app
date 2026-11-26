/**
 * 设备列表「哄睡管理」入口位 guard（静态层）。
 *
 * 与「听风原野信箱」共用 .hero-card 版式容器（flex 布局 / 内边距 / 圆角 / 卡片间距），
 * 两个主类只声明各自底色；本节点击后进入哄睡配置页（sleep-config），
 * 右侧插画走展示位 device-list/sleepy-elly。
 *
 * 本 guard 焊死七件事：
 *   1. 容器共用 .hero-card，布局属性不重复写在主类里
 *   2. 标题「哄睡管理」与副标题文案存在且非空
 *   3. 位置：设备卡片（含空态）之后、「听风原野信箱」之前
 *   4. 可点击且带悬停态 / 无障碍标签，路由目标是新页 sleep-config
 *   5. 右侧插画用 <elly-image>，asset-key / fallback / mode / lazy-load 正确且尺寸与 banner 一致
 *   6. 深夜蓝底色来自色板变量，不在业务样式里直写色值
 *   7. 展示位 key 已登记并带中文标签
 */
export {};

// 与 static-assets.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const PAGE = "pages/device-list/device-list";

const ASSET_KEY = "device-list/sleepy-elly";
const ASSET_KEY_CONST = "DEVICE_LIST_SLEEPY_ELLY";
const FALLBACK = "/static/images/kid-info/logo.png";
const SINGLE_IMAGE_LIMIT = 200 * 1024;
const ART_CLASS = "sleep-manage-hero__art";

const wxml: string = read(`${PAGE}.wxml`);
const wxss: string = read(`${PAGE}.wxss`);
const palette: string = read("styles/palette.wxss");

const SECTION_OPEN = 'class="hero-card sleep-manage-hero"';
const BANNER_COMMENT = "<!-- 来信反馈 banner";

function read(relative: string): string {
  return fs.readFileSync(path.join(MINIPROGRAM_ROOT, relative), "utf8");
}

/** 取单选择器规则体；`__` 修饰类不会误命中（选择器后紧跟 { 才算）。 */
function rule(selector: string): string {
  const match = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(wxss);
  return match ? match[1] : "";
}

/** 从声明块里取某个属性的值，取不到返回空串。 */
function declaration(body: string, property: string): string {
  const match = new RegExp(`(?:^|\\s)${property}:\\s*([^;]+);`).exec(body);
  return match ? match[1].trim() : "";
}

function attr(tagAttributes: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`).exec(
    tagAttributes,
  );
  return match ? match[1] : null;
}

/** 取出带指定 class 的 <elly-image> 标签属性串。 */
function findImageTag(source: string, className: string): string | null {
  const re = /<elly-image\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const attributes = match[1] || "";
    const classes = (attr(attributes, "class") || "").split(/\s+/);
    if (classes.includes(className)) return attributes;
  }
  return null;
}

describe("设备列表哄睡管理入口位", () => {
  const sectionStart = wxml.indexOf(SECTION_OPEN);
  const sectionEnd = wxml.indexOf(BANNER_COMMENT);

  it("容器存在，并与来信 banner 共用 .hero-card 版式类", () => {
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(wxml).toContain('class="hero-card feedback-hero"');
  });

  it("标题与副标题文案存在且非空", () => {
    const section = wxml.slice(sectionStart, sectionEnd);

    expect(section).toMatch(
      /<text class="sleep-manage-hero__title">哄睡管理<\/text>/,
    );
    expect(section).toMatch(
      /<text class="sleep-manage-hero__subtitle">设定睡眠时间与故事，到点陪宝贝入睡<\/text>/,
    );
  });

  it("可点击进入哄睡配置页，并带悬停与无障碍属性", () => {
    const section = wxml.slice(sectionStart, sectionEnd);
    const pageTs: string = read(`${PAGE}.ts`);

    expect(section).toContain('bind:tap="onSleepManageTap"');
    expect(section).toContain('hover-class="sleep-manage-hero-hover"');
    expect(section).toContain('aria-role="button"');
    expect(section).toContain("aria-label=");
    expect(section).not.toContain("<navigator");
    expect(pageTs).toContain("onSleepManageTap");
    expect(pageTs).toContain("/pages/sleep-config/sleep-config");
  });

  it("排在设备卡片（含空态）之后、来信 banner 之前", () => {
    const cardIndex = wxml.indexOf('wx:for="{{ devices }}"');
    const emptyIndex = wxml.indexOf("empty-device-card");
    const bannerIndex = wxml.search(/class="[^"]*\bfeedback-hero\b/);

    expect(cardIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(sectionStart).toBeGreaterThan(cardIndex);
    expect(sectionStart).toBeGreaterThan(emptyIndex);
    expect(sectionStart).toBeLessThan(bannerIndex);
  });

  it("右侧插画用 elly-image 承载，asset-key / fallback / mode / lazy-load 正确", () => {
    const attributes = findImageTag(wxml, ART_CLASS);

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe(ASSET_KEY);
    expect(attr(tag, "fallback")).toBe(FALLBACK);
    expect(attr(tag, "mode")).toBe("aspectFit");
    expect(attr(tag, "lazy-load")).toBe("{{ false }}");
    expect(wxml.slice(sectionStart, sectionEnd)).not.toContain("<image");
  });

  it("展示位 key 在 constants/app-asset-keys.ts 登记并带中文标签", () => {
    const source = read("constants/app-asset-keys.ts");

    expect(source).toContain(ASSET_KEY_CONST);
    expect(source).toContain(`"${ASSET_KEY}"`);
    expect(source).toContain(`[APP_ASSET_KEYS.${ASSET_KEY_CONST}]:`);
  });

  it("fallback 包内图真实存在且在单图预算内", () => {
    const relative = FALLBACK.replace(/^\/+/, "");
    const absolute = path.join(MINIPROGRAM_ROOT, relative);

    expect(fs.existsSync(absolute)).toBe(true);
    expect(fs.statSync(absolute).size).toBeLessThanOrEqual(SINGLE_IMAGE_LIMIT);
  });

  it("共用容器承载布局，两个主类只声明底色", () => {
    const base = rule(".hero-card");

    expect(declaration(base, "display")).toBe("flex");
    expect(declaration(base, "align-items")).toBe("center");
    expect(declaration(base, "justify-content")).toBe("space-between");
    expect(declaration(base, "padding")).toBe("24rpx 20rpx 24rpx 28rpx");
    expect(declaration(base, "margin-bottom")).toBe("32rpx");
    expect(declaration(base, "border-radius")).toBe("24rpx");

    for (const selector of [".feedback-hero", ".sleep-manage-hero"]) {
      const body = rule(selector);

      expect(body).not.toBe("");
      expect(body).not.toContain("display:");
      expect(body).not.toContain("padding:");
      expect(body).not.toContain("margin-bottom:");
      expect(body).not.toContain("border-radius:");
      expect(declaration(body, "background")).toContain("linear-gradient");
    }
  });

  it("右侧插画与 banner 插画同尺寸，保证两张卡等高", () => {
    const bannerArt = rule(".feedback-hero__art");
    const sleepArt = rule(".sleep-manage-hero__art");

    expect(declaration(sleepArt, "display")).toBe("block");
    expect(declaration(sleepArt, "width")).not.toBe("");
    expect(declaration(sleepArt, "width")).toBe(
      declaration(bannerArt, "width"),
    );
    expect(declaration(sleepArt, "height")).toBe(
      declaration(bannerArt, "height"),
    );
  });

  it("深夜蓝底色来自色板变量，标题与副标题用配套前景色", () => {
    const tokens = [
      "--color-sleep-deep",
      "--color-sleep-deep-end",
      "--color-sleep-title",
      "--color-sleep-subtitle",
    ];

    for (const token of tokens) {
      expect(palette).toContain(`${token}:`);
    }
    expect(declaration(rule(".sleep-manage-hero"), "background")).toContain(
      "var(--color-sleep-deep)",
    );
    expect(declaration(rule(".sleep-manage-hero__title"), "color")).toBe(
      "var(--color-sleep-title)",
    );
    expect(declaration(rule(".sleep-manage-hero__subtitle"), "color")).toBe(
      "var(--color-sleep-subtitle)",
    );
  });
});
