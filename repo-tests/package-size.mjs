import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAIN_PACKAGE_LIMIT,
  SUBPACKAGE_LIMIT,
  collectPackedFiles,
  findPackageViolations,
  isShippedCode,
  missingRequiredRules,
  packageBytes,
} from "./lib/package-size-core.mjs";

// 仓库级闸口：主包 / 分包体积上界。
//
// 事故背景（2026-11-28）：真机调试上传报 80051「source size 2441KB exceed
// max limit 2MB」。仓库当时既没有体积闸口，也没有把测试源码、示例截图、
// Finder 副本挡在包外 —— miniprogram/static 一个目录就 3.8MB。
//
// 口径：体积 = 进包源文件字节和（project.config.json 的 packOptions.ignore
// 生效后）。开发者工具上传前还会压缩 JS/WXML/WXSS，所以这个和是上界：
// 上界 ≤ 2MB 就一定不会触发 80051。.ts 由编译插件产出 .js，本身不上传，不计入。

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MINIPROGRAM_ROOT = path.join(REPO_ROOT, "miniprogram");

const projectConfig = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "project.config.json"), "utf8"),
);
const ignoreRules = projectConfig.packOptions?.ignore ?? [];

const appJson = JSON.parse(
  fs.readFileSync(path.join(MINIPROGRAM_ROOT, "app.json"), "utf8"),
);
const subpackageRoots = (appJson.subpackages ?? appJson.subPackages ?? []).map(
  (entry) => entry.root.replace(/\/$/, ""),
);

function listFiles(dir, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFiles(path.join(dir, entry.name), relative));
      continue;
    }
    files.push(relative);
  }
  return files;
}

const allFiles = listFiles(MINIPROGRAM_ROOT);
const packedFiles = collectPackedFiles(allFiles, ignoreRules);
const shipped = packedFiles
  .filter(isShippedCode)
  .map((relative) => ({
    path: relative,
    size: fs.statSync(path.join(MINIPROGRAM_ROOT, relative)).size,
  }));

function kb(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}

test("packOptions.ignore 覆盖测试、截图与系统元数据", () => {
  assert.deepEqual(missingRequiredRules(ignoreRules), []);
});

test("进包文件不含测试源码/产物、示例截图与 Finder 副本", () => {
  assert.deepEqual(findPackageViolations(packedFiles), []);
});

test("主包体积上界 ≤ 2MB", () => {
  const mainBytes = subpackageRoots.length
    ? shipped
        .filter(
          (entry) =>
            !subpackageRoots.some(
              (root) =>
                entry.path === root || entry.path.startsWith(`${root}/`),
            ),
        )
        .reduce((total, entry) => total + entry.size, 0)
    : packageBytes(shipped);
  assert.ok(
    mainBytes <= MAIN_PACKAGE_LIMIT,
    `主包源体积上界 ${kb(mainBytes)} 超出 ${kb(MAIN_PACKAGE_LIMIT)}`,
  );
});

test("每个分包体积上界 ≤ 2MB", () => {
  for (const root of subpackageRoots) {
    const bytes = packageBytes(shipped, root);
    assert.ok(
      bytes <= SUBPACKAGE_LIMIT,
      `分包 ${root} 源体积上界 ${kb(bytes)} 超出 ${kb(SUBPACKAGE_LIMIT)}`,
    );
  }
});
