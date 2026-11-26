/**
 * 吉祥物展示位远程化 guard（集成测试层）。
 *
 * 孩子信息（owner-info）与哄睡设置（sleep-manage）页头的吉祥物统一由
 * elly-bubble 组件承载，组件内用 elly-image + 远端 manifest：按 key 取图，
 * 未命中/加载失败回退包内 logo。本 guard 焊死四件事：
 *   1. 组件 wxml 用 <elly-image> 承载吉祥物，并保留 aspectFit 显示模式
 *   2. asset-key 走两页共用的业务展示位 key（OWNER_INFO_MASCOT）
 *   3. fallback 指向包内 /static/images/kid-info/logo.png 且文件真实存在
 *   4. 组件 json 注册 elly-image；两页不再直接引用 elly-image
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
const COMPONENT = "components/elly-bubble/elly-bubble";
const PAGES = [
  "pages/owner-info/owner-info",
  "pages/sleep-manage/sleep-manage",
];

const FALLBACK = "/static/images/kid-info/logo.png";
const ASSET_KEY = "owner-info/mascot";

function read(relative: string): string {
  return fs.readFileSync(path.join(MINIPROGRAM_ROOT, relative), "utf8");
}

function attr(tagAttributes: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`).exec(
    tagAttributes,
  );
  return match ? match[1] : null;
}

/** 取出组件模板里 <elly-image> 标签的属性串。 */
function findMascotTag(wxml: string): string | null {
  const re = /<elly-image\b([^>]*)>/g;
  const match = re.exec(wxml);
  return match ? match[1] || "" : null;
}

describe("吉祥物展示位走 elly-image", () => {
  it("elly-bubble 组件用 elly-image 承载吉祥物，展示位与兜底图为静态字面量", () => {
    const attributes = findMascotTag(read(`${COMPONENT}.wxml`));

    expect(attributes).not.toBeNull();
    const tag = attributes as string;
    expect(attr(tag, "asset-key")).toBe(ASSET_KEY);
    expect(attr(tag, "fallback")).toBe(FALLBACK);
    expect(attr(tag, "mode")).toBe("aspectFit");
  });

  it("展示位 key 已在常量表登记，两页共用同一个", () => {
    expect(read("constants/app-asset-keys.ts")).toContain(
      `OWNER_INFO_MASCOT: "${ASSET_KEY}"`,
    );
  });

  it("组件 json 注册了 elly-image", () => {
    const config = JSON.parse(read(`${COMPONENT}.json`));
    expect(config.usingComponents["elly-image"]).toContain(
      "components/elly-image/elly-image",
    );
  });

  it.each(PAGES)(
    "%s：不再直接 <image> 或 <elly-image> 渲染本地吉祥物",
    (name) => {
      const wxml = read(`${name}.wxml`);
      expect(wxml).not.toContain("<elly-image");
      expect(new RegExp(`<image\\b[^>]*${FALLBACK}`).test(wxml)).toBe(false);
    },
  );

  it("fallback 包内图真实存在", () => {
    const relative = FALLBACK.replace(/^\/+/, "");
    expect(fs.existsSync(path.join(MINIPROGRAM_ROOT, relative))).toBe(true);
  });
});
