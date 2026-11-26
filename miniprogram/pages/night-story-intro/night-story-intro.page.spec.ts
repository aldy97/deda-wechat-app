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

  it("三个分节按序排列", () => {
    const page = harness.createInstance();
    const titles: string[] = page.data.sections.map(
      (section: { title: string }) => section.title,
    );

    expect(titles).toEqual([
      "【固定的仪式】",
      "【可以抱着的陪伴】",
      "【属于孩子自己的晚安故事】",
    ]);
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
});
