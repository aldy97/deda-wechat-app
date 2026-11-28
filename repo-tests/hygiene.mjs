import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DUPLICATE_ALLOWLIST,
  EMPTY_DIR_ALLOWLIST,
  OVERSIZE_ALLOWLIST,
  ZERO_BYTE_ALLOWLIST,
} from "./lib/hygiene-allowlist.mjs";
import {
  findDuplicates,
  findEmptyDirs,
  findJunkNames,
  findOversizeFiles,
  findZeroByteFiles,
} from "./lib/hygiene-core.mjs";

// 仓库级卫生闸口：拦截「不该进仓库、更不该进小程序包」的文件。
//
// 事故背景（2026-11-28）：工作区被 Finder 副本、示例截图、.DS_Store 污染，
// 真机调试上传报 80051。这批文件是**未跟踪**的，CI 干净 checkout 永远看不到，
// 所以闸口必须同时覆盖两种视图：
//   tracked  —— git ls-files（CI / 已入库垃圾）
//   worktree —— 文件系统（本地 hook / 未跟踪垃圾）
//
// 固定排除：依赖、构建产物、本地运行时目录。排除项必须写清理由，
// 否则「排除」会变成第二个白名单。

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const IGNORED_PATHS = [
  [".git", "Git 元数据"],
  ["node_modules", "依赖目录"],
  ["miniprogram/miniprogram_npm", "构建 npm 产物，可再生"],
  [".runtime", "本地运行时/回收站，不进包"],
  ["coverage", "覆盖率产物，可再生"],
  ["design-mockups", "设计稿，本机资产，不进包"],
  ["artifacts", "历史交付快照，已移出仓库"],
  ["ble_doc_work", "docx 处理中间产物"],
  [".tmp", "运行时临时目录"],
];

const OVERSIZE_LIMIT = 1024 * 1024;

function isIgnored(relPath) {
  return IGNORED_PATHS.some(
    ([prefix]) => relPath === prefix || relPath.startsWith(`${prefix}/`),
  );
}

function toPosix(absolute) {
  return path.relative(REPO_ROOT, absolute).split(path.sep).join("/");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** 入库文件：路径、大小、内容哈希（>2MB 不哈希，避免无谓 IO） */
function listTrackedFiles() {
  const raw = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return raw
    .split("\0")
    .filter(Boolean)
    .flatMap((relPath) => {
      const absolute = path.join(REPO_ROOT, relPath);
      // 已 staged 删除但未提交的文件仍在 index 里：工作区不存在就跳过
      if (!fs.existsSync(absolute)) return [];
      const { size } = fs.lstatSync(absolute);
      const hash = size > 2 * 1024 * 1024 ? "" : sha256(absolute);
      return [{ path: relPath, size, hash }];
    });
}

/** 工作区文件 + 空目录：跳过 IGNORED_PATHS 与符号链接 */
function walkWorktree() {
  const files = [];
  const emptyDirs = [];

  function walk(absolute, relPath) {
    let entries;
    try {
      entries = fs.readdirSync(absolute, { withFileTypes: true });
    } catch (error) {
      return;
    }
    if (entries.length === 0 && relPath) {
      emptyDirs.push(relPath);
      return;
    }
    for (const entry of entries) {
      const childRelative = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (isIgnored(childRelative)) continue;
      const childAbsolute = path.join(absolute, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(childAbsolute, childRelative);
        continue;
      }
      let size;
      try {
        size = fs.lstatSync(childAbsolute).size;
      } catch (error) {
        continue;
      }
      files.push({ path: childRelative, size });
    }
  }

  walk(REPO_ROOT, "");
  return { files, emptyDirs };
}

const tracked = listTrackedFiles();
const worktree = walkWorktree();

// 构建产物（.js）由 guard:artifacts 管，不参与重复内容比对
const worktreeForHashes = worktree.files
  .filter((entry) => !entry.path.endsWith(".js"))
  .map((entry) => ({
    ...entry,
    hash:
      entry.size > 2 * 1024 * 1024
        ? ""
        : sha256(path.join(REPO_ROOT, entry.path)),
  }));

function format(paths) {
  return paths.map((item) => `  - ${item}`).join("\n");
}

test("垃圾命名：.DS_Store / AppleDouble / Finder 副本不留在仓库", () => {
  const violations = [
    ...new Set([
      ...findJunkNames(tracked.map((entry) => entry.path)),
      ...findJunkNames(worktree.files.map((entry) => entry.path)),
    ]),
  ];
  assert.deepEqual(
    violations,
    [],
    `发现垃圾文件：\n${format(violations)}\n修复：移出仓库（mv 到 .runtime/trash/ 或桌面归档）`,
  );
});

test("0 字节入库文件为 0（空占位必须登记白名单）", () => {
  const violations = findZeroByteFiles(tracked, ZERO_BYTE_ALLOWLIST);
  assert.deepEqual(violations, [], `0 字节文件：\n${format(violations)}`);
});

test("工作区空目录为 0（白名单外的空目录一律删除）", () => {
  const violations = findEmptyDirs(worktree.emptyDirs, {
    allowlist: EMPTY_DIR_ALLOWLIST,
    ignored: IGNORED_PATHS.map(([prefix]) => prefix),
  });
  assert.deepEqual(
    violations,
    [],
    `空目录：\n${format(violations)}\n修复：rmdir（空目录不进 Git，但会干扰工具链）`,
  );
});

test("重复内容为 0（同内容不同路径默认视为拷贝事故）", () => {
  const violations = findDuplicates(worktreeForHashes, {
    allowlist: DUPLICATE_ALLOWLIST,
  }).map((group) => group.join(" == "));
  assert.deepEqual(
    violations,
    [],
    `重复内容：\n${format(violations)}\n修复：保留一份，其余引用的地方改路径`,
  );
});

test("单个入库文件不超过 1MB（大文件必须走归档或 CDN）", () => {
  const violations = findOversizeFiles(tracked, {
    limit: OVERSIZE_LIMIT,
    allowlist: OVERSIZE_ALLOWLIST,
  });
  assert.deepEqual(
    violations,
    [],
    `超大文件：\n${format(violations)}\n修复：移出仓库（交付物放 ~/Desktop 归档目录）`,
  );
});

test("白名单条目全部仍然有效（失效条目必须删除）", () => {
  const existingPaths = new Set(worktree.files.map((entry) => entry.path));
  for (const [allowlist, label] of [
    [ZERO_BYTE_ALLOWLIST, "ZERO_BYTE_ALLOWLIST"],
    [EMPTY_DIR_ALLOWLIST, "EMPTY_DIR_ALLOWLIST"],
    [OVERSIZE_ALLOWLIST, "OVERSIZE_ALLOWLIST"],
  ]) {
    const stale = Object.keys(allowlist).filter(
      (relPath) => !existingPaths.has(relPath),
    );
    assert.deepEqual(stale, [], `${label} 存在失效条目：${stale.join(", ")}`);
  }
});
