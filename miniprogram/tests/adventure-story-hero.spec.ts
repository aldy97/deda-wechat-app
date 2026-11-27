/**
 * 设备列表「冒险故事」入口位 guard（静态层）。
 *
 * 与「哄睡管理」「听风原野信箱」共用 .hero-card 版式容器（flex 布局 / 内边距 /
 * 圆角 / 卡片间距），三个主类只声明各自底色；本节点击后进入冒险故事介绍页，
 * 右侧插画走展示位 device-list/adventure-story。
 *
 * 本 guard 焊死七件事：
 *   1. 容器共用 .hero-card，布局属性不重复写在主类里
 *   2. 标题「冒险故事」与副标题文案存在且非空
 *   3. 位置：设备卡片（含空态）之后、哄睡入口之前、来信 banner 之前
 *   4. 可点击且带悬停态 / 无障碍标签，路由目标是新页 adventure-story
 *   5. 右侧插画用 <elly-image>，asset-key / fallback / mode / lazy-load 正确且尺寸与 banner 一致
 *   6. 底色用薄荷绿浅渐变（135° 双色），前景用配套深色，且只用色板变量
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

const ASSET_KEY = "device-list/adventure-story";
const ASSET_KEY_CONST = "DEVICE_LIST_ADVENTURE_STORY";
const FALLBACK = "/static/images/device-list/adventure-story.png";
const SINGLE_IMAGE_LIMIT = 200 * 1024;
const ART_CLASS = "adventure-story-hero__art";

const wxml: string = read(`${PAGE}.wxml`);
const wxss: string = read(`${PAGE}.wxss`);
const palette: string = read("styles/palette.wxss");

const SECTION_OPEN = 'class="hero-card adventure-story-hero"';
const SLEEP_OPEN = 'class="hero-card sleep-manage-hero"';
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

describe("设备列表冒险故事入口位", () => {
  const sectionStart = wxml.indexOf(SECTION_OPEN);
  const sectionEnd = wxml.indexOf(SLEEP_OPEN);

  it("容器存在，并与哄睡入口 / 来信 banner 共用 .hero-card 版式类", () => {
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(wxml).toContain('class="hero-card feedback-hero"');
    expect(wxml).toContain('class="hero-card sleep-manage-hero"');
  });

  it("标题与副标题文案存在且非空", () => {
    const section = wxml.slice(sectionStart, sectionEnd);

    expect(section).toMatch(
      /<text class="adventure-story-hero__title">冒险故事<\/text>/,
    );
    expect(section).toMatch(
      /<text class="adventure-story-hero__subtitle">每天一段新旅程，和 Elly 一起探索听风原野<\/text>/,
    );
  });

  it("可点击进入冒险故事页，并带悬停与无障碍属性", () => {
    const section = wxml.slice(sectionStart, sectionEnd);
    const pageTs: string = read(`${PAGE}.ts`);

    expect(section).toContain('bind:tap="onAdventureStoryTap"');
    expect(section).toContain('hover-class="adventure-story-hero-hover"');
    expect(section).toContain('aria-role="button"');
    expect(section).toContain("aria-label=");
    expect(section).not.toContain("<navigator");
    expect(pageTs).toContain("onAdventureStoryTap");
    expect(pageTs).toContain("/pages/adventure-story/adventure-story");
  });

  it("排在设备卡片（含空态）之后、哄睡入口与来信 banner 之前", () => {
    const cardIndex = wxml.indexOf('class="device-card card"');
    const emptyIndex = wxml.indexOf("empty-device-card");
    const sleepIndex = wxml.indexOf(SLEEP_OPEN);
    const bannerIndex = wxml.search(/class="[^"]*\bfeedback-hero\b/);

    expect(cardIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(-1);
    expect(sleepIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(sectionStart).toBeGreaterThan(cardIndex);
    expect(sectionStart).toBeGreaterThan(emptyIndex);
    expect(sectionStart).toBeLessThan(sleepIndex);
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

  it("共用容器承载布局，主类只声明底色", () => {
    const base = rule(".hero-card");

    expect(declaration(base, "display")).toBe("flex");
    expect(declaration(base, "align-items")).toBe("center");
    expect(declaration(base, "justify-content")).toBe("space-between");
    expect(declaration(base, "padding")).toBe("24rpx 20rpx 24rpx 28rpx");
    expect(declaration(base, "margin-bottom")).toBe("32rpx");
    expect(declaration(base, "border-radius")).toBe("24rpx");

    const body = rule(".adventure-story-hero");

    expect(body).not.toBe("");
    expect(body).not.toContain("display:");
    expect(body).not.toContain("padding:");
    expect(body).not.toContain("margin-bottom:");
    expect(body).not.toContain("border-radius:");
    expect(declaration(body, "background")).toContain("linear-gradient");
  });

  it("右侧插画与 banner 插画同尺寸，保证三张卡等高", () => {
    const bannerArt = rule(".feedback-hero__art");
    const adventureArt = rule(`.${ART_CLASS}`);

    expect(declaration(adventureArt, "display")).toBe("block");
    expect(declaration(adventureArt, "width")).not.toBe("");
    expect(declaration(adventureArt, "width")).toBe(
      declaration(bannerArt, "width"),
    );
    expect(declaration(adventureArt, "height")).toBe(
      declaration(bannerArt, "height"),
    );
  });

  it("入口卡使用薄荷绿浅渐变，前景用配套深色", () => {
    const tokens = ["--color-mode-2-soft", "--color-surface"];

    for (const token of tokens) {
      expect(palette).toContain(`${token}:`);
    }
    const background = declaration(
      rule(".adventure-story-hero"),
      "background",
    );
    expect(background).toContain("linear-gradient");
    expect(background).toContain("135deg");
    expect(background).toContain("var(--color-mode-2-soft)");
    expect(background).toContain("var(--color-surface)");
    expect(declaration(rule(".adventure-story-hero__title"), "color")).toBe(
      "var(--color-heading)",
    );
    expect(declaration(rule(".adventure-story-hero__subtitle"), "color")).toBe(
      "var(--color-body)",
    );
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
