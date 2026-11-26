/**
 * 设备列表「听风原野信箱」banner guard（集成测试层）。
 *
 * banner 是「代码版式 + 插画槽位」：文案/版式/底色全部由 wxml + wxss 出，
 * 只有插画走远端展示位 device-list/feedback-hero；未命中/加载失败回退包内小象头。
 * 参考图（1089×344 的整张海报）只作设计参照，不得进包——否则代码版式与图内文案重复。
 *
 * 本 guard 焊死六件事：
 *   1. 插画用 <elly-image> 承载，asset-key / fallback 正确、aspectFit、不懒加载
 *   2. banner 容器可点击（bind:tap → onFeedbackHeroTap）且带无障碍标签
 *   3. 四条文案节点存在且非空（标题 / 副标题 / 两行正文）
 *   4. asset-key 在 constants/app-asset-keys.ts 登记并带中文标签
 *   5. 页面 json 注册了 elly-image 组件
 *   6. fallback 包内图存在、在单图预算内，且参考图未被打进包
 */
export {};

// 与 static-assets.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");

const PAGE = "pages/device-list/device-list";
const CONSTANTS = "constants/app-asset-keys.ts";
const ASSET_KEY = "device-list/feedback-hero";
const ASSET_KEY_CONST = "DEVICE_LIST_FEEDBACK_HERO";
const FALLBACK = "/static/images/kid-info/logo.png";
const ART_CLASS = "feedback-hero__art";
const REFERENCE_IMAGE = "static/images/device-list/feedback-hero.jpg";
const SINGLE_IMAGE_LIMIT = 200 * 1024;

/** 文案节点：class → 必含片段（空节点/文案丢失都在此变红） */
const COPY_NODES: Array<{ className: string; contains: string }> = [
  { className: "feedback-hero__title", contains: "听风原野信箱" },
  { className: "feedback-hero__subtitle", contains: "反馈产品问题" },
  { className: "feedback-hero__desc", contains: "第一时间帮您解决问题" },
  { className: "feedback-hero__desc", contains: "启智卡" },
];

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

/** 取出带指定 class 的 <text> 节点文本（去标签）。 */
function findTextNodes(wxml: string, className: string): string[] {
  const re = new RegExp(
    `<text\\b[^>]*class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</text>`,
    "g",
  );
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(wxml)) !== null) {
    result.push((match[1] || "").trim());
  }
  return result;
}

describe("设备列表来信反馈 banner：代码版式 + 插画槽位", () => {
  const wxml = read(`${PAGE}.wxml`);

  it("插画用 elly-image 承载，asset-key / fallback / mode / lazy-load 正确", () => {
    const attributes = findImageTag(wxml, ART_CLASS);

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe(ASSET_KEY);
    expect(attr(tag, "fallback")).toBe(FALLBACK);
    expect(attr(tag, "mode")).toBe("aspectFit");
    expect(attr(tag, "lazy-load")).toBe("{{ false }}");
  });

  it("banner 容器可点击且带无障碍标签", () => {
    const re =
      /<view\b([^>]*\bclass\s*=\s*["'][^"']*\bfeedback-hero\b[^"']*["'][^>]*)>/;
    const match = re.exec(wxml);

    expect(match).not.toBeNull();
    const attributes = match ? match[1] : "";
    expect(attr(attributes, "bind:tap")).toBe("onFeedbackHeroTap");
    expect(attr(attributes, "aria-label")).toBeTruthy();
  });

  it.each(COPY_NODES)(
    "文案节点 .$className 存在且包含「$contains」",
    ({ className, contains }) => {
      const nodes = findTextNodes(wxml, className);

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.some((text) => text.includes(contains))).toBe(true);
      expect(nodes.every((text) => text.length > 0)).toBe(true);
    },
  );

  it("banner 排在设备卡片（含空态）之后", () => {
    const bannerIndex = wxml.indexOf('class="feedback-hero"');
    const cardIndex = wxml.indexOf('wx:for="{{ devices }}"');
    const emptyIndex = wxml.indexOf("empty-device-card");

    expect(bannerIndex).toBeGreaterThan(-1);
    expect(cardIndex).toBeGreaterThan(-1);
    expect(emptyIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(cardIndex);
    expect(bannerIndex).toBeGreaterThan(emptyIndex);
  });

  it("展示位 key 在 constants/app-asset-keys.ts 登记并带中文标签", () => {
    const source = read(CONSTANTS);

    expect(source).toContain(ASSET_KEY_CONST);
    expect(source).toContain(`"${ASSET_KEY}"`);
    expect(source).toContain(`[APP_ASSET_KEYS.${ASSET_KEY_CONST}]:`);
  });

  it("页面 json 注册了 elly-image 组件", () => {
    const config = JSON.parse(read(`${PAGE}.json`));
    expect(config.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it("fallback 包内图真实存在且在单图预算内", () => {
    const relative = FALLBACK.replace(/^\/+/, "");
    const absolute = path.join(MINIPROGRAM_ROOT, relative);

    expect(fs.existsSync(absolute)).toBe(true);
    expect(fs.statSync(absolute).size).toBeLessThanOrEqual(SINGLE_IMAGE_LIMIT);
  });

  it("参考图不得进包（版式与文案以代码为准）", () => {
    expect(fs.existsSync(path.join(MINIPROGRAM_ROOT, REFERENCE_IMAGE))).toBe(
      false,
    );
  });

  it("不再用裸 <image> 渲染 banner 插图（远程化被回退会在此变红）", () => {
    const rawImage = new RegExp(`<image\\b[^>]*${FALLBACK}`);
    expect(rawImage.test(wxml)).toBe(false);
  });
});
