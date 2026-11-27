/**
 * adventure-story-mode 页面装配测试。
 *
 * 本页是「冒险故事模式」介绍页：版式与 night-story-intro 一致——
 * 顶部 hero-bg + 纯黑正文、标题居中；内容覆盖每日冒险玩法与四段科学依据。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

require("./adventure-story-mode");

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

describe("adventure-story-mode page 装配", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("大标题为「听风原野的每日冒险」", () => {
    const page = harness.createInstance();

    expect(page.data.heroTitle).toBe("听风原野的每日冒险");
  });

  it("开篇两段覆盖星星掉落、每日一集与星光守护者", () => {
    const page = harness.createInstance();
    const intro: string = page.data.introParagraphs.join("");

    expect(page.data.introParagraphs).toHaveLength(2);
    expect(intro).toContain("一阵大风把天上的星星吹落到了听风原野");
    expect(intro).toContain("每天一集，约5分钟");
    expect(intro).toContain("星光守护者");
  });

  it("四个分节按序排列，标题不带【】", () => {
    const page = harness.createInstance();
    const titles: string[] = page.data.sections.map(
      (section: { title: string }) => section.title,
    );

    expect(titles).toEqual([
      "来回对话，而不只是听",
      "没有屏幕，用耳朵和想象去冒险",
      "看着朋友勇敢，自己也会更勇敢",
      "每天一点点，坚持被看见",
    ]);
    for (const section of page.data.sections) {
      expect(section.title).not.toContain("【");
      expect(section.title).not.toContain("】");
    }
  });

  it("每个分节都带非空正文，并覆盖关键研究/口号", () => {
    const page = harness.createInstance();
    const body: string = page.data.sections
      .map((section: { body: string }) => section.body)
      .join("");

    for (const section of page.data.sections) {
      expect(section.body.trim().length).toBeGreaterThan(0);
    }
    expect(body).toContain("麻省理工学院2018年");
    expect(body).toContain("世界卫生组织");
    expect(body).toContain("班杜拉");
    expect(body).toContain("德韦克");
    expect(body).toContain("Daily Effort Deserves Applause");
  });

  it("wxml 渲染大标题、开篇与分节（含标题与正文绑定）", () => {
    const wxml: string = read("adventure-story-mode.wxml");

    expect(wxml).toContain("{{ heroTitle }}");
    expect(wxml).toContain('wx:for="{{ introParagraphs }}"');
    expect(wxml).toContain('wx:for="{{ sections }}"');
    expect(wxml).toContain("{{ item.title }}");
    expect(wxml).toContain("{{ item.body }}");
  });

  it("正文区用与 hero-bg 协调的森林绿渐变，并压住 hero 底部做无缝过渡", () => {
    const wxss: string = read("adventure-story-mode.wxss");
    const pageRule = rule(wxss, ".adventure-story-mode-page");
    const body = rule(wxss, ".adventure-story-mode-body");
    const palette: string = read("../../styles/palette.wxss");

    expect(pageRule).toContain("min-height: 100vh");
    expect(pageRule).toContain(
      "background: var(--color-adventure-mode-bg-end)",
    );
    expect(pageRule).not.toContain("var(--color-night-story-bg)");

    expect(body).toContain("margin-top: -120rpx");
    expect(body).toContain("padding: 152rpx 32rpx 64rpx");
    expect(body).toContain("linear-gradient");
    expect(body).toContain("transparent 0");
    expect(body).toContain("var(--color-adventure-mode-bg-start) 120rpx");
    expect(body).toContain("var(--color-adventure-mode-bg-mid) 55%");
    expect(body).toContain("var(--color-adventure-mode-bg-end) 100%");

    for (const token of [
      "--color-adventure-mode-bg-start",
      "--color-adventure-mode-bg-mid",
      "--color-adventure-mode-bg-end",
    ]) {
      expect(palette).toContain(`${token}:`);
    }
  });

  it("页面级背景用渐变末端色兜底，下拉回弹不露浅色底", () => {
    const wxss: string = read("adventure-story-mode.wxss");
    const pageRule = /\npage\s*\{([^}]*)\}/.exec(wxss);

    expect(pageRule).not.toBeNull();
    expect((pageRule as RegExpExecArray)[1]).toContain(
      "background-color: var(--color-adventure-mode-bg-end)",
    );
  });

  it("渐变上的文字仍用色板里的浅色，且不出现直接色值", () => {
    const wxss: string = read("adventure-story-mode.wxss");

    expect(wxss).toContain("var(--color-sleep-title)");
    expect(wxss).toContain("var(--color-sleep-subtitle)");
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it("header 维持系统白色导航栏，标题为「冒险故事模式」", () => {
    const json: {
      navigationStyle?: string;
      backgroundColor?: string;
      navigationBarBackgroundColor?: string;
      navigationBarTitleText?: string;
    } = JSON.parse(read("adventure-story-mode.json"));

    expect(json.navigationStyle).toBeUndefined();
    expect(json.backgroundColor).toBeUndefined();
    expect(json.navigationBarBackgroundColor).toBeUndefined();
    expect(json.navigationBarTitleText).toBe("冒险故事模式");
  });

  it("顶部 hero 用 elly-image 承载展示位 adventure-story-mode/hero-bg，未命中走渐变兜底", () => {
    const wxml: string = read("adventure-story-mode.wxml");
    const attributes = findImageTag(wxml, "adventure-story-mode-hero__bg");

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe("adventure-story-mode/hero-bg");
    expect(attr(tag, "fallback")).toBe("");
    expect(attr(tag, "empty-fallback")).toBe("{{ true }}");
    expect(attr(tag, "mode")).toBe("aspectFill");
    expect(attr(tag, "lazy-load")).toBe("{{ false }}");
    expect(wxml).not.toContain("<image");
  });

  it("hero 排在大标题之前，高度按背景图原始比例换算并保留兜底值", () => {
    const wxml: string = read("adventure-story-mode.wxml");
    const page = harness.createInstance();
    const heroIndex = wxml.indexOf('class="adventure-story-mode-hero"');

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

  it("背景图事件或 detail 缺失时保持当前高度", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad(undefined);
    expect(page.data.heroHeight).toBe(440);

    page.onHeroImageLoad({});
    expect(page.data.heroHeight).toBe(440);
  });

  it("展示位 key 已登记并带中文标签，页面 json 注册了 elly-image", () => {
    const constants: string = read("../../constants/app-asset-keys.ts");
    const json: { usingComponents: Record<string, string> } = JSON.parse(
      read("adventure-story-mode.json"),
    );

    expect(constants).toContain("ADVENTURE_STORY_MODE_HERO_BG");
    expect(constants).toContain('"adventure-story-mode/hero-bg"');
    expect(constants).toContain(
      "[APP_ASSET_KEYS.ADVENTURE_STORY_MODE_HERO_BG]:",
    );
    expect(json.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it("hero 容器裁切溢出，背景层四边外扩 1px 消除露底", () => {
    const wxss: string = read("adventure-story-mode.wxss");
    const hero = rule(wxss, ".adventure-story-mode-hero");
    const bg = rule(wxss, ".adventure-story-mode-hero__bg");

    expect(hero).toContain("position: relative");
    expect(hero).toContain("overflow: hidden");
    expect(hero).toContain("var(--color-adventure-mode-bg-start)");
    expect(bg).toContain("position: absolute");
    expect(bg).toContain("left: -1px");
    expect(bg).toContain("calc(100% + 2px)");
  });
});
