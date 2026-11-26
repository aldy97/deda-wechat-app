/**
 * night-story-intro 页面装配测试。
 *
 * 本页是「晚安故事模式」介绍页（功能版）：只承载文案，样式待设计稿确认。
 * guard 焊死三件事：花字标题、开篇两段（定时提醒 + 冒险故事转晚安故事）、
 * 三个分节（固定仪式 / 抱着陪伴 / 属于孩子自己的晚安故事）按序且正文非空。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

require("./night-story-intro");

function read(relative: string): string {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

function rule(wxss: string, selector: string): string {
  const match = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(wxss);
  return match ? match[1] : "";
}

function attr(tagAttributes: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`).exec(
    tagAttributes,
  );
  return match ? match[1] : null;
}

function findImageTag(wxml: string, className: string): string | null {
  const re = /<elly-image\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(wxml)) !== null) {
    const attributes = match[1] || "";
    const classes = (attr(attributes, "class") || "").split(/\s+/);
    if (classes.includes(className)) return attributes;
  }
  return null;
}

describe("night-story-intro page 装配", () => {
  it("花字标题为「听风原野的晚安时间」", () => {
    const page = harness.createInstance();

    expect(page.data.heroTitle).toBe("听风原野的晚安时间");
  });

  it("开篇两段覆盖定时提醒、冒险故事与自动停止", () => {
    const page = harness.createInstance();
    const intro: string = page.data.introParagraphs.join("");

    expect(page.data.introParagraphs).toHaveLength(2);
    expect(intro).toContain("DEDA听风原野的小居民会轻轻提醒孩子");
    expect(intro).toContain("【冒险故事】");
    expect(intro).toContain("故事结束后自动停止");
  });

  it("三个分节按序排列，标题不带【】", () => {
    const page = harness.createInstance();
    const titles: string[] = page.data.sections.map(
      (section: { title: string }) => section.title,
    );

    expect(titles).toEqual([
      "固定的仪式",
      "可以抱着的陪伴",
      "属于孩子自己的晚安故事",
    ]);
  });

  it("大标题与分节标题居中，且字号保持不变", () => {
    const page = harness.createInstance();
    const wxss: string = read("night-story-intro.wxss");
    const heroTitle = rule(wxss, ".night-story-hero-title");
    const sectionTitle = rule(wxss, ".night-story-section-title");

    expect(heroTitle).toContain("text-align: center");
    expect(heroTitle).toContain("font-size: 48rpx");
    expect(sectionTitle).toContain("text-align: center");
    expect(sectionTitle).toContain("font-size: 32rpx");
    for (const section of page.data.sections) {
      expect(section.title).not.toContain("【");
      expect(section.title).not.toContain("】");
    }
  });

  it("每个分节都带非空正文", () => {
    const page = harness.createInstance();

    for (const section of page.data.sections) {
      expect(section.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("wxml 渲染花字、开篇与分节（含标题与正文绑定）", () => {
    const wxml: string = fs.readFileSync(
      path.join(__dirname, "night-story-intro.wxml"),
      "utf8",
    );

    expect(wxml).toContain("{{ heroTitle }}");
    expect(wxml).toContain('wx:for="{{ introParagraphs }}"');
    expect(wxml).toContain('wx:for="{{ sections }}"');
    expect(wxml).toContain("{{ item.title }}");
    expect(wxml).toContain("{{ item.body }}");
  });

  it("内容区用哄睡入口卡的蓝色渐变铺满首屏", () => {
    const wxss: string = read("night-story-intro.wxss");

    expect(wxss).toContain("min-height: 100vh");
    expect(wxss).toContain("var(--color-sleep-card-start)");
    expect(wxss).toContain("var(--color-sleep-card-end)");
    expect(wxss).toMatch(/linear-gradient\(\s*180deg/);
  });

  it("深蓝底上的文字改用色板里的浅色，且不出现直接色值", () => {
    const wxss: string = read("night-story-intro.wxss");

    expect(wxss).toContain("var(--color-sleep-title)");
    expect(wxss).toContain("var(--color-sleep-subtitle)");
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("header 维持系统白色导航栏：页面 json 不覆盖导航样式与背景色", () => {
    const json: {
      navigationStyle?: string;
      backgroundColor?: string;
      navigationBarBackgroundColor?: string;
      navigationBarTitleText?: string;
    } = JSON.parse(read("night-story-intro.json"));

    expect(json.navigationStyle).toBeUndefined();
    expect(json.backgroundColor).toBeUndefined();
    expect(json.navigationBarBackgroundColor).toBeUndefined();
    expect(json.navigationBarTitleText).toBe("晚安故事模式");
  });

  it("顶部 hero 用 elly-image 承载展示位 night-story-intro/hero-bg，未命中走渐变兜底", () => {
    const wxml: string = read("night-story-intro.wxml");
    const attributes = findImageTag(wxml, "night-story-hero__bg");

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe("night-story-intro/hero-bg");
    expect(attr(tag, "fallback")).toBe("");
    expect(attr(tag, "empty-fallback")).toBe("{{ true }}");
    expect(attr(tag, "mode")).toBe("aspectFill");
    expect(attr(tag, "lazy-load")).toBe("{{ false }}");
    expect(wxml).not.toContain("<image");
  });

  it("hero 排在花字之前，高度按背景图原始比例换算并保留兜底值", () => {
    const wxml: string = read("night-story-intro.wxml");
    const page = harness.createInstance();
    const heroIndex = wxml.indexOf('class="night-story-hero"');

    expect(heroIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeLessThan(wxml.indexOf("{{ heroTitle }}"));
    expect(wxml).toContain('style="height: {{ heroHeight }}rpx;"');

    expect(page.data.heroHeight).toBe(440);
    page.onHeroImageLoad({ detail: { width: 750, height: 440 } });
    expect(page.data.heroHeight).toBe(440);
    page.onHeroImageLoad({ detail: { width: 750, height: 500 } });
    expect(page.data.heroHeight).toBe(500);
    page.onHeroImageLoad({ detail: {} });
    expect(page.data.heroHeight).toBe(500);
  });

  it("展示位 key 已登记并带中文标签，页面 json 注册了 elly-image", () => {
    const constants: string = read("../../constants/app-asset-keys.ts");
    const json: { usingComponents: Record<string, string> } = JSON.parse(
      read("night-story-intro.json"),
    );

    expect(constants).toContain("NIGHT_STORY_INTRO_HERO_BG");
    expect(constants).toContain('"night-story-intro/hero-bg"');
    expect(constants).toContain("[APP_ASSET_KEYS.NIGHT_STORY_INTRO_HERO_BG]:");
    expect(json.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it("hero 容器裁切溢出，背景层四边外扩 1px 消除露底", () => {
    const wxss: string = read("night-story-intro.wxss");
    const hero = rule(wxss, ".night-story-hero");
    const bg = rule(wxss, ".night-story-hero__bg");

    expect(hero).toContain("position: relative");
    expect(hero).toContain("overflow: hidden");
    expect(hero).toContain("var(--color-sleep-card-start)");
    expect(bg).toContain("position: absolute");
    expect(bg).toContain("left: -1px");
    expect(bg).toContain("calc(100% + 2px)");
  });
});
