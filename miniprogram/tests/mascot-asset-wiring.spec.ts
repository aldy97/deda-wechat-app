/**
 * 吉祥物展示位远程化 guard（集成测试层）。
 *
 * 哄睡管理（sleep-manage）与孩子信息（owner-info）页头的吉祥物统一走
 * elly-image + 远端 manifest：按 key 取图，未命中/加载失败回退包内 logo。
 * 本 guard 焊死四件事：
 *   1. wxml 用 <elly-image> 承载吉祥物，并保留 aspectFit 显示模式
 *   2. asset-key 使用各自的业务展示位 key（不再借用诊断探针）
 *   3. fallback 指向包内 /static/images/kid-info/logo.png 且文件真实存在
 *   4. 页面 json 注册了 elly-image 组件，且不再直接 <image src=本地 logo>
 *
 * 事故预防：远程化一旦被回退成裸 <image>，表现上与预期完全一致（同一张图），
 * 只有这条断言会在 CI 里变红。
 */
export {};

// 与 static-assets.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");

const FALLBACK = "/static/images/kid-info/logo.png";

interface MascotPage {
  name: string;
  mascotClass: string;
  assetKey: string;
}

const PAGES: MascotPage[] = [
  {
    name: "pages/owner-info/owner-info",
    mascotClass: "kid-mascot",
    assetKey: "owner-info/mascot",
  },
  {
    name: "pages/sleep-manage/sleep-manage",
    mascotClass: "sleep-mascot",
    assetKey: "sleep-manage/mascot",
  },
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

/** 取出页面里带指定 mascot class 的 <elly-image> 标签属性串。 */
function findMascotTag(wxml: string, mascotClass: string): string | null {
  const re = /<elly-image\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(wxml)) !== null) {
    const attributes = match[1] || "";
    const classes = (attr(attributes, "class") || "").split(/\s+/);
    if (classes.includes(mascotClass)) return attributes;
  }
  return null;
}

describe("吉祥物展示位走 elly-image", () => {
  it.each(PAGES)(
    "$name：wxml 用 elly-image 承载吉祥物，asset-key 与 fallback 正确",
    ({ name, mascotClass, assetKey }) => {
      const wxml = read(`${name}.wxml`);
      const attributes = findMascotTag(wxml, mascotClass);

      expect(attributes).not.toBeNull();
      const tag = attributes as string;
      expect(attr(tag, "asset-key")).toBe(assetKey);
      expect(attr(tag, "fallback")).toBe(FALLBACK);
      expect(attr(tag, "mode")).toBe("aspectFit");
    },
  );

  it.each(PAGES)("$name：页面 json 注册了 elly-image 组件", ({ name }) => {
    const config = JSON.parse(read(`${name}.json`));
    expect(config.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it.each(PAGES)(
    "$name：不再直接 <image> 渲染本地吉祥物图（远程化被回退会在此变红）",
    ({ name }) => {
      const wxml = read(`${name}.wxml`);
      const rawImage = new RegExp(`<image\\b[^>]*${FALLBACK}`);
      expect(rawImage.test(wxml)).toBe(false);
    },
  );

  it("fallback 包内图真实存在", () => {
    const relative = FALLBACK.replace(/^\/+/, "");
    expect(fs.existsSync(path.join(MINIPROGRAM_ROOT, relative))).toBe(true);
  });
});
