/**
 * 本地静态图片 guard（集成测试层）。
 *
 * 事故背景：owner-info 的男女头像曾用包内 .webp，开发者工具与 Android 正常，
 * iOS 真机两张卡片全空白。微信 image 组件的 webp 属性「只支持网络资源」，
 * 本地 webp 不会被解码 —— 这是 jest 与开发者工具都抓不到的格式盲区。
 *
 * 本 guard 静态扫描 miniprogram 源码与 static 目录，焊死六条不变量：
 *   1. 引用的本地文件真实存在（防路径改错、资源漏提交）
 *   2. 本地图片不得使用 webp（要 webp 只能走 https 网络资源）
 *   3. 本地路径必须可静态解析（禁止 {{}} / ${} 动态绑定与字符串拼接）
 *   4. static 下的图片必须被源码引用，或登记在 ORPHAN_ALLOWLIST
 *   5. 单张图片不得超过 SINGLE_IMAGE_LIMIT，或登记在 OVERSIZE_ALLOWLIST
 *   6. static 目录总量不得超过 TOTAL_STATIC_LIMIT
 *
 * 白名单必须带原因，且条目失效（文件被删或已不再触发）会让测试变红。
 */
export {};

// 与 app-routing.spec.ts 同口径：wx typings 与 @types/node 全局声明冲突，
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.join(MINIPROGRAM_ROOT, "static");
const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm", "tests"]);
const REFERENCE_FILE_EXTENSIONS = new Set([".wxml", ".wxss", ".json", ".ts"]);
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
]);

const SINGLE_IMAGE_LIMIT = 200 * 1024;
const TOTAL_STATIC_LIMIT = 1.5 * 1024 * 1024;

/** 单图预算白名单：键为相对 miniprogram 根目录的路径，值必须写明原因 */
const OVERSIZE_ALLOWLIST: Record<string, string> = {};

/** 孤儿图片白名单：只允许登记确实需要保留的未引用资源 */
const ORPHAN_ALLOWLIST: Record<string, string> = {};

interface LocalImageRef {
  file: string;
  src: string;
}

interface ReferenceScan {
  refs: LocalImageRef[];
  dynamic: string[];
  unresolved: string[];
}

function toRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

function walkFiles(
  root: string,
  visit: (file: string) => void,
  skipDirs: Set<string>,
  skipHidden: boolean,
): void {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (skipHidden && entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name))
        walkFiles(full, visit, skipDirs, skipHidden);
      continue;
    }
    visit(full);
  }
}

/** 源码侧需要扫描引用的文件：wxml/wxss/json/ts，排除测试、类型声明与编译产物 */
function collectReferenceFiles(): string[] {
  const files: string[] = [];
  walkFiles(
    MINIPROGRAM_ROOT,
    (file) => {
      const name = path.basename(file);
      if (name.endsWith(".d.ts") || name.endsWith(".spec.ts")) return;
      if (REFERENCE_FILE_EXTENSIONS.has(path.extname(file).toLowerCase()))
        files.push(file);
    },
    SKIP_DIRS,
    false,
  );
  return files;
}

function parseLocalStaticPath(raw: string): string | null {
  const cleaned = raw.split(/[?#]/)[0];
  if (!IMAGE_EXTENSIONS.has(path.extname(cleaned).toLowerCase())) return null;
  return cleaned.replace(/^\/+/, "");
}

function scanReferences(): ReferenceScan {
  const result: ReferenceScan = { refs: [], dynamic: [], unresolved: [] };

  for (const file of collectReferenceFiles()) {
    const content = fs.readFileSync(file, "utf-8");
    const relative = toRelative(MINIPROGRAM_ROOT, file);
    const re = /\/?static\/[^\s"'`<>)]*/g;
    let match: RegExpExecArray | null;

    while ((match = re.exec(content)) !== null) {
      const before = match.index > 0 ? content[match.index - 1] : "";
      // 跳过网络 URL 里的路径片段（https://host/static/x.png 不是本地资源）
      if (/[A-Za-z0-9_.:-]/.test(before)) continue;

      const raw = match[0];
      const location = `${relative} -> ${raw}`;
      if (raw.includes("{{") || raw.includes("${")) {
        result.dynamic.push(location);
        continue;
      }

      const src = parseLocalStaticPath(raw);
      if (src === null) {
        result.unresolved.push(location);
        continue;
      }
      result.refs.push({ file: relative, src });
    }
  }

  return result;
}

function collectStaticFiles(): string[] {
  const files: string[] = [];
  walkFiles(STATIC_ROOT, (file) => files.push(file), new Set(), true);
  return files;
}

function isImage(file: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function sizeOf(file: string): number {
  return fs.statSync(file).size;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`;
}

describe("本地静态图片引用", () => {
  const scan = scanReferences();

  it("能扫描到源码中的本地图片引用", () => {
    expect(scan.refs.length).toBeGreaterThan(0);
  });

  it("引用的本地图片文件真实存在", () => {
    const missing = scan.refs
      .filter((ref) => !fs.existsSync(path.join(MINIPROGRAM_ROOT, ref.src)))
      .map((ref) => `${ref.file} -> /${ref.src}`);
    expect(missing).toEqual([]);
  });

  it("不使用本地 webp（image 组件只解码网络 webp）", () => {
    const localWebp = scan.refs
      .filter((ref) => path.extname(ref.src).toLowerCase() === ".webp")
      .map((ref) => `${ref.file} -> /${ref.src}`);
    expect(localWebp).toEqual([]);
  });

  it("本地图片路径必须可静态解析（禁止动态绑定与拼接）", () => {
    expect({ dynamic: scan.dynamic, unresolved: scan.unresolved }).toEqual({
      dynamic: [],
      unresolved: [],
    });
  });
});

describe("孤儿资源（static 下未被任何源码引用的图片）", () => {
  const referenced = new Set(scanReferences().refs.map((ref) => ref.src));
  const imageFiles = collectStaticFiles()
    .filter(isImage)
    .map((file) => toRelative(MINIPROGRAM_ROOT, file));

  it("孤儿白名单条目必须仍然存在且仍然未被引用", () => {
    const stale = Object.keys(ORPHAN_ALLOWLIST).filter((rel) => {
      const abs = path.join(MINIPROGRAM_ROOT, rel);
      return !fs.existsSync(abs) || referenced.has(rel);
    });
    expect(stale).toEqual([]);
  });

  it("static 下的图片必须被引用，或登记在孤儿白名单", () => {
    const orphans = imageFiles
      .filter((rel) => !referenced.has(rel) && !(rel in ORPHAN_ALLOWLIST))
      .map(
        (rel) => `${rel}（${kb(sizeOf(path.join(MINIPROGRAM_ROOT, rel)))}）`,
      );
    expect(orphans).toEqual([]);
  });
});

describe("静态资源体积预算", () => {
  const staticFiles = collectStaticFiles();
  const images = staticFiles.filter(isImage);

  it("单张图片不超过 200KB（体积白名单除外）", () => {
    const oversize = images
      .map((file) => ({
        rel: toRelative(MINIPROGRAM_ROOT, file),
        bytes: sizeOf(file),
      }))
      .filter(
        ({ rel, bytes }) =>
          bytes > SINGLE_IMAGE_LIMIT && !(rel in OVERSIZE_ALLOWLIST),
      )
      .sort((a, b) => b.bytes - a.bytes)
      .map(({ rel, bytes }) => `${rel}（${kb(bytes)}）`);
    expect(oversize).toEqual([]);
  });

  it("体积白名单条目必须仍然存在且确实超限", () => {
    const stale = Object.keys(OVERSIZE_ALLOWLIST).filter((rel) => {
      const abs = path.join(MINIPROGRAM_ROOT, rel);
      return !fs.existsSync(abs) || sizeOf(abs) <= SINGLE_IMAGE_LIMIT;
    });
    expect(stale).toEqual([]);
  });

  it("static 目录总量不超过 1.5MB", () => {
    const total = staticFiles.reduce((sum, file) => sum + sizeOf(file), 0);
    if (total > TOTAL_STATIC_LIMIT) {
      const top = images
        .map((file) => ({
          rel: toRelative(MINIPROGRAM_ROOT, file),
          bytes: sizeOf(file),
        }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 5)
        .map(({ rel, bytes }) => `${rel}（${kb(bytes)}）`);
      throw new Error(
        `static 总量 ${kb(total)} 超出预算 ${kb(TOTAL_STATIC_LIMIT)}；Top 5：${top.join("，")}`,
      );
    }
    expect(total).toBeLessThanOrEqual(TOTAL_STATIC_LIMIT);
  });
});
