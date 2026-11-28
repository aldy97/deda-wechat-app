import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ANY_ALLOWLIST } from "./lib/any-allowlist.mjs";
import {
  checkQuota,
  countAnyInSource,
  summarizeCounts,
} from "./lib/any-guard-core.mjs";

// 仓库级类型闸口：全仓不允许显式 any。
//
// 口径（2026-11-28 与熊总确认）：
//   - 生产代码（非 *.spec.ts、非 tests/）any 必须为 0；
//   - 测试代码按文件登记配额，只降不升，逐文件 burn-down；
//   - 本地 hook 与 CI 跑同一条命令：node --test repo-tests/*.mjs。
//
// 与 tsc 的分工：tsc 管隐式 any / 类型错误，本闸口管显式 any（tsc 不报）。

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MINIPROGRAM_ROOT = path.join(REPO_ROOT, "miniprogram");
const SKIP_DIRS = new Set(["miniprogram_npm", "node_modules", "vendor"]);

function collectTsFiles(dir, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...collectTsFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    files.push(`${prefix}${entry.name}`);
  }
  return files;
}

const counts = new Map();
for (const relative of collectTsFiles(MINIPROGRAM_ROOT)) {
  const absolute = path.join(MINIPROGRAM_ROOT, relative);
  const total = countAnyInSource(fs.readFileSync(absolute, "utf8"), relative);
  if (total > 0) counts.set(`miniprogram/${relative}`, total);
}

test("全仓显式 any 符合配额（生产 0，测试只降不升）", () => {
  const errors = checkQuota(counts, ANY_ALLOWLIST);
  assert.deepEqual(
    errors,
    [],
    `any 配额不通过：\n${errors.map((item) => `  - ${item}`).join("\n")}`,
  );
});

test("any 存量汇总（信息性，不阻断）", () => {
  const summary = summarizeCounts(counts);
  const quiet = summary
    .filter(([dir]) => !dir.startsWith("miniprogram/tests"))
    .map(([dir, total]) => `${dir}: ${total}`);
  assert.ok(
    summary.length > 0 || Object.keys(ANY_ALLOWLIST).length === 0,
    `当前 any 汇总：${quiet.join("，")}`,
  );
});
