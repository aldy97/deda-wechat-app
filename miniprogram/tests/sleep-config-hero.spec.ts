/**
 * 哄睡配置页 hero / 科学原理 banner guard（静态层）。
 *
 * 本 guard 焊死六件事：
 *   1. hero 背景图走 elly-image 展示位 sleep-config/hero-bg，fallback 留空走渐变兜底
 *   2. hero 只叠白色「哄睡管理」标题与三个能力标签（不含自动熄屏），且标签来自页面数据
 *   3. 科学原理 banner 文案与 GO 徽标存在，且不设点击 / 路由
 *   4. 顺序：hero → 科学原理 banner → 共享表单
 *   5. 展示位 key 已登记并带中文标签
 *   6. hero 兜底渐变与遮罩只用色板变量，且标签条目的口径与产品决定一致
 */
export {};

// 与 static-assets.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const PAGE = "pages/sleep-config/sleep-config";

const ASSET_KEY = "sleep-config/hero-bg";
const ASSET_KEY_CONST = "SLEEP_CONFIG_HERO_BG";
const BG_CLASS = "sleep-config-hero__bg";

const wxml: string = read(`${PAGE}.wxml`);
const wxss: string = read(`${PAGE}.wxss`);
const ts: string = read(`${PAGE}.ts`);

function read(relative: string): string {
  return fs.readFileSync(path.join(MINIPROGRAM_ROOT, relative), "utf8");
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

/** 取单选择器规则体；`__` 修饰类不会误命中（选择器后紧跟 { 才算）。 */
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

describe("哄睡配置页 hero 与科学原理 banner", () => {
  it("背景图用 elly-image 承载展示位 sleep-config/hero-bg，fallback 留空", () => {
    const attributes = findImageTag(wxml, BG_CLASS);

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe(ASSET_KEY);
    expect(attr(tag, "fallback")).toBe("");
    expect(attr(tag, "empty-fallback")).toBe("{{ true }}");
    expect(attr(tag, "mode")).toBe("aspectFill");
    expect(attr(tag, "lazy-load")).toBe("{{ false }}");
    expect(wxml).not.toContain("<image");
  });

  it("hero 叠白色「哄睡管理」标题与数据驱动的能力标签", () => {
    expect(wxml).toMatch(
      /<text class="sleep-config-hero__title">哄睡管理<\/text>/,
    );
    expect(wxml).toContain('wx:for="{{ heroTags }}"');
    expect(declaration(rule(".sleep-config-hero__title"), "color")).toBe(
      "var(--color-surface)",
    );
  });

  it("能力标签为三个，且不含自动熄屏", () => {
    expect(ts).toContain('"心理共鸣"');
    expect(ts).toContain('"Kid Affirmation"');
    expect(ts).toContain('"脑波调节"');
    expect(ts).not.toContain("自动熄屏");
  });

  it("科学原理 banner 文案与 GO 徽标存在，且不设点击 / 路由", () => {
    expect(wxml).toMatch(
      /<text class="science-banner__title">了解更多哄睡的科学原理<\/text>/,
    );
    expect(wxml).toContain("science-banner__badge-text");
    expect(wxml).toContain("GO");
    expect(wxml).not.toContain("bind:tap");
    expect(wxml).not.toContain("<navigator");
  });

  it("顺序：hero → 科学原理 banner → 共享表单", () => {
    const heroIndex = wxml.indexOf('class="sleep-config-hero"');
    const bannerIndex = wxml.indexOf('class="science-banner"');
    const formIndex = wxml.indexOf("<sleep-config-form");

    expect(heroIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(heroIndex);
    expect(formIndex).toBeGreaterThan(bannerIndex);
  });

  it("展示位 key 已登记并带中文标签", () => {
    const source = read("constants/app-asset-keys.ts");

    expect(source).toContain(ASSET_KEY_CONST);
    expect(source).toContain(`"${ASSET_KEY}"`);
    expect(source).toContain(`[APP_ASSET_KEYS.${ASSET_KEY_CONST}]:`);
  });

  it("hero 兜底渐变与遮罩只用色板变量", () => {
    const hero = rule(".sleep-config-hero");
    const mask = rule(".sleep-config-hero__mask");

    expect(declaration(hero, "background")).toContain(
      "var(--color-sleep-deep)",
    );
    expect(declaration(mask, "background")).toContain(
      "var(--color-sleep-hero-mask-strong)",
    );
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("背景图容器绝对铺满 hero，避免占位撑高版式", () => {
    const bg = rule(".sleep-config-hero__bg");

    expect(declaration(bg, "position")).toBe("absolute");
    expect(declaration(bg, "width")).toBe("100%");
    expect(declaration(bg, "height")).toBe("100%");
  });
});
