/**
 * adventure-story 页面装配测试。
 *
 * 本页是「冒险故事」介绍页：顶部 hero 背景图走 adventure-story/hero-bg，
 * 下方承载每日一集的玩法说明、只读的「每日冒险」状态位与语音触发指引；
 * 本期不接后端，总开关不放到页面上做假交互。
 */
import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installPageHarness();

require("./adventure-story");

function read(relative: string): string {
  return fs.readFileSync(path.join(__dirname, relative), "utf8");
}

describe("adventure-story page 装配", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("onLoad 注入 deviceId", () => {
    const page = harness.createInstance();

    page.onLoad({ id: "dev-1" });

    expect(page.data.deviceId).toBe("dev-1");
  });

  it("缺少设备 id 时提示但不抛错", () => {
    const page = harness.createInstance();

    page.onLoad(undefined);

    expect(page.data.deviceId).toBe("");
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "缺少设备信息",
      icon: "none",
    });
  });

  it("页头标题与副标题", () => {
    const page = harness.createInstance();

    expect(page.data.heroTitle).toBe("和 Elly 一起去冒险");
    expect(page.data.heroSubtitle).toBe("每天一集，孩子做选择，故事往前走");
  });

  it("hero 高度按背景图原始比例换算（750rpx 宽）", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad({ detail: { width: 750, height: 500 } });

    expect(page.data.heroHeight).toBe(500);
  });

  it("背景图尺寸缺失或比例相等时保持兜底高度", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad({ detail: {} });
    expect(page.data.heroHeight).toBe(440);

    page.onHeroImageLoad({ detail: { width: 750, height: 440 } });
    expect(page.data.heroHeight).toBe(440);
  });

  it("背景图事件或 detail 缺失时保持兜底高度", () => {
    const page = harness.createInstance();

    page.onHeroImageLoad(undefined);
    expect(page.data.heroHeight).toBe(440);

    page.onHeroImageLoad({});
    expect(page.data.heroHeight).toBe(440);
  });

  it("三段说明按序排列且正文非空", () => {
    const page = harness.createInstance();
    const titles: string[] = page.data.sections.map(
      (section: { title: string }) => section.title,
    );

    expect(titles).toEqual([
      "每天只安排一集",
      "孩子做选择，故事向前走",
      "一起收集星光",
    ]);
    for (const section of page.data.sections) {
      expect(section.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("WXML 渲染 hero 背景图、只读状态与语音指引", () => {
    const wxml: string = read("adventure-story.wxml");

    expect(wxml).toContain('asset-key="adventure-story/hero-bg"');
    expect(wxml).toContain('fallback=""');
    expect(wxml).toContain('empty-fallback="{{ true }}"');
    expect(wxml).toContain('style="height: {{ heroHeight }}rpx;"');
    expect(wxml).toContain('bind:load="onHeroImageLoad"');
    expect(wxml).toContain("{{ heroTitle }}");
    expect(wxml).toContain("{{ heroSubtitle }}");
    expect(wxml).toContain("每日冒险");
    expect(wxml).toContain("默认开启");
    expect(wxml).toContain("每天一集");
    expect(wxml).toContain("总开关将在后续版本开放");
    expect(wxml).toContain("我想听冒险故事");
    expect(wxml).toContain('wx:for="{{ sections }}"');
    expect(wxml).toContain("{{ item.title }}");
    expect(wxml).toContain("{{ item.body }}");
  });

  it("hero 展示位 key 已登记并带中文标签", () => {
    const source = read("../../constants/app-asset-keys.ts");

    expect(source).toContain("ADVENTURE_STORY_HERO_BG");
    expect(source).toContain('"adventure-story/hero-bg"');
    expect(source).toContain("[APP_ASSET_KEYS.ADVENTURE_STORY_HERO_BG]:");
  });

  it("页面 json 注册 kid-gradient-bg 与 elly-image", () => {
    const config = JSON.parse(read("adventure-story.json"));

    expect(config.usingComponents["kid-gradient-bg"]).toContain(
      "components/kid-gradient-bg/kid-gradient-bg",
    );
    expect(config.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it("页面样式不直写色值，底色回到 kid 渐变收口", () => {
    const wxss: string = read("adventure-story.wxss");
    const pageRule = /\npage\s*\{([^}]*)\}/.exec(wxss);

    expect(pageRule).not.toBeNull();
    expect((pageRule as RegExpExecArray)[1]).toContain(
      "background-color: var(--color-kid-bg-bottom)",
    );
    expect(wxss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
