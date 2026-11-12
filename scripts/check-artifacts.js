#!/usr/bin/env node
/**
 * 编译产物时效性 guard。
 *
 * 本仓库唯一事实源是 .ts（.gitignore 屏蔽了 miniprogram/**\/*.js），
 * 微信开发者工具跑的却是 tsc 产出的 .js。改了 .ts 忘跑 `npm run build`，
 * 或 merge/checkout 之后 .ts 被刷新而 .js 仍是旧的，开发者工具里就是旧代码——
 * 界面与仓库源码脱节，且没有任何报错提示。
 *
 * 两类问题都拦：
 *   MISSING —— .ts 没有对应的 .js（从未构建过）
 *   STALE   —— .js 的 mtime 早于 .ts（构建后又改了源码 / merge 刷新了 .ts）
 *
 * 修复方式永远只有一个：npm run build
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniRoot = path.join(root, "miniprogram");
const SKIP_DIRS = new Set(["miniprogram_npm", "node_modules"]);

const missing = [];
const stale = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(file);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    // .d.ts 是纯类型声明，tsc 不产出对应 .js
    if (entry.name.endsWith(".d.ts")) continue;
    check(file);
  }
}

function check(tsFile) {
  checked += 1;
  const jsFile = `${tsFile.slice(0, -".ts".length)}.js`;
  const relative = path.relative(root, tsFile);

  if (!fs.existsSync(jsFile)) {
    missing.push(relative);
    return;
  }
  const tsMtime = fs.statSync(tsFile).mtimeMs;
  const jsMtime = fs.statSync(jsFile).mtimeMs;
  if (jsMtime < tsMtime) {
    stale.push(`${relative} → ${path.relative(root, jsFile)}`);
  }
}

walk(miniRoot);

if (missing.length || stale.length) {
  if (missing.length) {
    console.error(`\n❌ 缺失编译产物（${missing.length} 个）：`);
    for (const item of missing) console.error(`   MISSING  ${item}`);
  }
  if (stale.length) {
    console.error(`\n❌ 编译产物陈旧，.ts 比 .js 新（${stale.length} 个）：`);
    for (const item of stale) console.error(`   STALE    ${item}`);
  }
  console.error(
    "\n微信开发者工具跑的是 .js，现在它与源码不一致。执行 `npm run build` 后重试。\n",
  );
  process.exit(1);
}

console.log(`编译产物检查通过：${checked} 个 .ts 均有最新 .js`);
