/**
 * 「Elly + 对话气泡」单一实现 guard。
 *
 * 孩子信息页（owner-info）与哄睡设置页（sleep-manage）页头必须是同一个
 * <elly-bubble> 组件，不允许任何一页再各自维护一份结构或样式：
 *   1. 两页 wxml 只通过 <elly-bubble> 渲染，不再出现 <elly-image> 与旧类名
 *   2. 旧视觉类（kid-/sleep- 前缀的 bubble 与 mascot）全仓仅允许出现在组件内部
 *   3. 气泡文案集中在页面 TS 的 bubbleLines，wxml 不硬编码
 *   4. 两个入口都受 fromBind 门控（绑定引导显示、日常设置不提示）
 *
 * 事故预防：复制一份 bubble 结构/样式在视觉上与预期完全一致，
 * 只有这条断言会在 CI 里变红。
 */
export {};

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COMPONENT = "components/elly-bubble/elly-bubble";
const PAGES = [
  {
    name: "pages/owner-info/owner-info",
    heroClass: "kid-hero",
    firstLine: "请先录入宝贝的信息吧",
  },
  {
    name: "pages/sleep-manage/sleep-manage",
    heroClass: "sleep-hero",
    firstLine: "请设置宝贝的常规睡眠时间吧",
  },
];

const LEGACY_CLASSES = [
  "kid-bubble",
  "sleep-bubble",
  "kid-mascot",
  "sleep-mascot",
];

const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm", "tests"]);

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function walk(
  dir: string,
  visit: (relative: string) => void,
  base = ROOT,
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, visit, base);
      continue;
    }
    visit(path.relative(base, full).split(path.sep).join("/"));
  }
}

/** 取 <elly-bubble> 标签前 200 字符，用于确认门控包裹层就在它上方 */
function beforeBubbleTag(wxml: string): string {
  const index = wxml.indexOf("<elly-bubble");
  expect(index).toBeGreaterThan(-1);
  return wxml.slice(Math.max(0, index - 200), index);
}

describe("Elly + 对话气泡单一实现", () => {
  it.each(PAGES)("$name：只通过 elly-bubble 渲染页头", ({ name }) => {
    const wxml = read(`${name}.wxml`);

    expect(wxml).toContain("<elly-bubble");
    expect(wxml).not.toContain("<elly-image");
    expect(wxml).toContain('lines="{{ bubbleLines }}"');
  });

  it.each(PAGES)(
    "$name：气泡受 fromBind 门控（日常设置不提示）",
    ({ name, heroClass }) => {
      const wxml = read(`${name}.wxml`);
      const before = beforeBubbleTag(wxml);

      expect(before).toContain(`${heroClass}`);
      expect(before).toContain('wx:if="{{ fromBind }}"');
    },
  );

  it.each(PAGES)(
    "$name：气泡文案在页面 TS，不在 wxml 硬编码",
    ({ name, firstLine }) => {
      expect(read(`${name}.ts`)).toContain(firstLine);
      expect(read(`${name}.wxml`)).not.toContain(firstLine);
    },
  );

  it.each(PAGES)(
    "$name：json 注册 elly-bubble，不再直接注册 elly-image",
    ({ name }) => {
      const config = JSON.parse(read(`${name}.json`));

      expect(config.usingComponents["elly-bubble"]).toBe(
        "/components/elly-bubble/elly-bubble",
      );
      expect(config.usingComponents["elly-image"]).toBeUndefined();
    },
  );

  it("旧视觉类只允许出现在组件内部", () => {
    const offenders: string[] = [];
    // 只认类名本体：`--color-kid-bubble` 是合法色板变量，不能被误判
    const legacyPattern = new RegExp(
      `(^|[^-\\w])(?:${LEGACY_CLASSES.join("|")})\\b`,
    );

    walk(ROOT, (relative) => {
      if (relative.startsWith("components/elly-bubble/")) return;
      if (!/\.(wxml|wxss|json|ts)$/.test(relative)) return;
      if (relative.endsWith(".spec.ts")) return;
      const content = read(relative);
      if (legacyPattern.test(content)) {
        offenders.push(relative);
      }
    });

    expect(offenders).toEqual([]);
  });

  it("组件 wxml 是唯一出现 elly-image 的两页页头实现", () => {
    expect(read(`${COMPONENT}.wxml`)).toContain("<elly-image");
  });
});
