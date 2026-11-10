/**
 * 路由完整性 guard（集成测试层）。
 *
 * 在 node 环境静态校验 app.json 注册表与真实文件、源码导航目标的一致性：
 *   1. 每个注册页面的 .ts/.wxml/.wxss/.json 四文件齐全
 *   2. tabBar.pagePath 均已注册
 *   3. pages 无重复、首页文件存在
 *   4. 源码中 wx.navigateTo/redirectTo/switchTab/reLaunch 的静态目标均已注册
 *   5. tabBar 页面只能被 switchTab/reLaunch 指向（微信限制）
 *   6. 注册但不可达的「孤儿页面」必须在显式白名单中
 *   7. 磁盘上存在但未注册的页面目录必须在显式白名单中（device-analysis 式死页面）
 *
 * 页面增删 / 新增导航无需修改本文件；guard 会自动拦截不一致。
 */

import { resolveModeRoute } from "../pages/switch-mode/switch-mode.utils";

// 小程序 wx typings 与 @types/node 全局声明冲突，不能混用；
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const MINIPROGRAM_ROOT = path.join(__dirname, "..");
const PAGE_FILE_EXTENSIONS = [".ts", ".wxml", ".wxss", ".json"];

/**
 * 已知的「注册但不可达」页面白名单。
 * device-provision / device-control 均已有 device-list 入口可达，白名单清零。
 * 白名单只允许减少，不允许新增。
 */
const KNOWN_ORPHAN_PAGES: string[] = [];

/**
 * 已知的「磁盘存在但未注册」页面目录白名单。
 * 必须保持为空：任何未注册的页面目录都是死页面。
 */
const KNOWN_UNREGISTERED_PAGES: string[] = [];

interface AppJson {
  pages: string[];
  tabBar?: { list?: Array<{ pagePath: string }> };
}

interface RouteRef {
  /** 去掉前导斜杠与 query 的页面路径 */
  target: string;
  api: string;
  file: string;
}

function readAppJson(): AppJson {
  const raw = fs.readFileSync(path.join(MINIPROGRAM_ROOT, "app.json"), "utf-8");
  return JSON.parse(raw);
}

/** 递归收集 miniprogram 下的 .ts（排除测试与依赖目录）与 .wxml 源码文件 */
function collectSourceFiles(): string[] {
  const results: string[] = [];
  const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm"]);

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (entry.name.endsWith(".spec.ts")) continue;
      if (entry.name.endsWith(".ts") || entry.name.endsWith(".wxml")) {
        results.push(full);
      }
    }
  }

  walk(MINIPROGRAM_ROOT);
  return results;
}

function toPagePath(raw: string): string {
  return raw.split("${")[0].split("?")[0].replace(/^\//, "");
}

/** 提取源码中 wx.navigateTo 等调用的静态路由目标（截断模板变量与 query） */
function extractRouteRefs(files: string[]): RouteRef[] {
  const pattern =
    /\bwx\.(navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{[\s\S]{0,300}?url\s*:\s*[`'"]([^`'"]+)[`'"]/g;
  const refs: RouteRef[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const target = toPagePath(match[2]);
      if (!target.startsWith("pages/")) continue;
      refs.push({
        target,
        api: match[1],
        file: path.relative(MINIPROGRAM_ROOT, file),
      });
    }
  }
  return refs;
}

/**
 * 提取源码中所有 `/pages/...` 字符串字面量。
 * 覆盖 resolveModeRoute 等「先返回路由字符串、再由变量跳转」的间接导航。
 */
function extractPagePathLiterals(files: string[]): string[] {
  const pattern = /[`'"](\/pages\/[^`'"]+)[`'"]/g;
  const targets = new Set<string>();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const target = toPagePath(match[1]);
      if (target.startsWith("pages/")) targets.add(target);
    }
  }
  return Array.from(targets);
}

/** 列出 miniprogram/pages 下所有页面目录（含四文件中的任意一个即视为页面目录） */
function listPageDirectories(): string[] {
  const pagesDir = path.join(MINIPROGRAM_ROOT, "pages");
  return fs
    .readdirSync(pagesDir, { withFileTypes: true })
    .filter((entry: any) => entry.isDirectory())
    .map((entry: any) => `pages/${entry.name}/${entry.name}`);
}

describe("app.json 路由完整性", () => {
  const appJson = readAppJson();
  const pages = appJson.pages;
  const tabBarPaths = (appJson.tabBar?.list ?? []).map((item) => item.pagePath);
  const sourceFiles = collectSourceFiles();
  const routeRefs = extractRouteRefs(sourceFiles);
  const pagePathLiterals = extractPagePathLiterals(sourceFiles);

  it("每个注册页面的四文件（.ts/.wxml/.wxss/.json）齐全", () => {
    const missing: string[] = [];
    for (const page of pages) {
      for (const ext of PAGE_FILE_EXTENSIONS) {
        const file = path.join(MINIPROGRAM_ROOT, `${page}${ext}`);
        if (!fs.existsSync(file)) missing.push(`${page}${ext}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("pages 无重复且首页存在", () => {
    expect(new Set(pages).size).toBe(pages.length);
    expect(fs.existsSync(path.join(MINIPROGRAM_ROOT, `${pages[0]}.ts`))).toBe(
      true,
    );
  });

  it("tabBar 引用的页面均已注册", () => {
    for (const pagePath of tabBarPaths) {
      expect(pages).toContain(pagePath);
    }
  });

  it("源码中的静态导航目标均已注册", () => {
    const unregistered = routeRefs.filter((ref) => !pages.includes(ref.target));
    expect(unregistered).toEqual([]);
  });

  it("tabBar 页面不被 navigateTo/redirectTo 指向", () => {
    const violations = routeRefs.filter(
      (ref) =>
        tabBarPaths.includes(ref.target) &&
        (ref.api === "navigateTo" || ref.api === "redirectTo"),
    );
    expect(violations).toEqual([]);
  });

  it("注册但不可达的页面仅限于已知白名单", () => {
    // 可达性 = wx.* 直接导航目标 ∪ 源码中的 /pages/ 字面量（间接导航）
    const reachableTargets = new Set([
      ...routeRefs.map((ref) => ref.target),
      ...pagePathLiterals,
    ]);
    const entryPage = pages[0];
    const orphans = pages.filter(
      (page) =>
        page !== entryPage &&
        !tabBarPaths.includes(page) &&
        !reachableTargets.has(page),
    );
    expect(orphans.sort()).toEqual([...KNOWN_ORPHAN_PAGES].sort());
  });

  it("磁盘上的页面目录均已注册（未注册仅限已知白名单）", () => {
    const unregistered = listPageDirectories().filter(
      (dir) => !pages.includes(dir),
    );
    expect(unregistered.sort()).toEqual([...KNOWN_UNREGISTERED_PAGES].sort());
  });

  it("resolveModeRoute 返回的每个路由均已注册", () => {
    const modeKeys = [
      "free_chat",
      "textbook_learning",
      "locked_unit",
      "free_textbook",
    ];
    for (const key of modeKeys) {
      const route = resolveModeRoute(key, "dev-001");
      if (route === null) continue;
      const target = toPagePath(route);
      expect(pages).toContain(target);
    }
  });
});
