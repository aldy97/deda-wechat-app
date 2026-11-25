/**
 * 本地静态图片 guard（集成测试层）。
 *
 * 事故背景：owner-info 的男女头像曾用包内 .webp，开发者工具与 Android 正常，
 * iOS 真机两张卡片全空白。微信 image 组件的 webp 属性「只支持网络资源」，
 * 本地 webp 不会被解码 —— 这是 jest 与开发者工具都抓不到的格式盲区。
 *
 * 本 guard 静态扫描所有 wxml 的本地图片引用，焊死两条不变量：
 *   1. 引用的本地文件真实存在（防路径改错、资源漏提交）
 *   2. 本地图片不得使用 webp（要 webp 只能走 https 网络资源）
 */
export {};

// 与 app-routing.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm"]);
const LOCAL_IMAGE_SRC_RE = /src="(\/static\/[^"]+)"/g;

interface LocalImageRef {
  file: string;
  src: string;
}

/** 递归收集所有 wxml 中的本地（/static/ 开头）图片引用，跳过动态绑定 */
function collectLocalImageRefs(): LocalImageRef[] {
  const refs: LocalImageRef[] = [];

  function scanWxml(file: string) {
    const content = fs.readFileSync(file, "utf-8");
    const relative = path.relative(MINIPROGRAM_ROOT, file);
    let match: RegExpExecArray | null;
    const re = new RegExp(LOCAL_IMAGE_SRC_RE.source, "g");
    while ((match = re.exec(content)) !== null) {
      const src = match[1];
      if (src.includes("{{")) continue;
      refs.push({ file: relative, src });
    }
  }

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (entry.name.endsWith(".wxml")) scanWxml(full);
    }
  }

  walk(MINIPROGRAM_ROOT);
  return refs;
}

describe("本地静态图片资源", () => {
  const refs = collectLocalImageRefs();

  it("能扫描到 wxml 中的本地图片引用", () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it("引用的本地图片文件真实存在", () => {
    const missing = refs
      .filter((ref) => !fs.existsSync(path.join(MINIPROGRAM_ROOT, ref.src)))
      .map((ref) => `${ref.file} -> ${ref.src}`);
    expect(missing).toEqual([]);
  });

  it("不使用本地 webp（image 组件只解码网络 webp）", () => {
    const localWebp = refs
      .filter((ref) => path.extname(ref.src).toLowerCase() === ".webp")
      .map((ref) => `${ref.file} -> ${ref.src}`);
    expect(localWebp).toEqual([]);
  });
});
