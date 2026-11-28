import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_DIR_ALLOWLIST,
  JUNK_ALLOWLIST,
  OVERSIZE_ALLOWLIST,
  ZERO_BYTE_ALLOWLIST,
} from "./lib/hygiene-allowlist.mjs";
import {
  JUNK_PATTERNS,
  findDuplicates,
  findEmptyDirs,
  findOversizeFiles,
  findZeroByteFiles,
  isJunkName,
  staleAllowlistEntries,
} from "./lib/hygiene-core.mjs";

// 闸口自身 fixture：规则写错时这里先红，而不是等到真机上传或 CI 才发现。
// 与 asset-gates.test.mjs 同口径：只测纯判定函数，不碰仓库真实文件。

describe("isJunkName", () => {
  it("macOS / Office / Finder 产出的垃圾名全部命中", () => {
    const junk = [
      ".DS_Store",
      "miniprogram/static/.DS_Store",
      "._avatar.png",
      "~$report.docx",
      "avatar_boy 2.png",
      "static-assets.spec 2.ts",
      "device-card copy.jpg",
      "设计稿副本.png",
    ];
    assert.deepEqual(junk.filter(isJunkName), junk);
  });

  it("正常文件名不误报", () => {
    const ok = [
      "avatar_boy.png",
      "user-manual-v2.jpg",
      "copy.ts",
      "副本配置.json",
      "any-guard.mjs",
      "pages/device-list/device-list.ts",
    ];
    assert.deepEqual(ok.filter(isJunkName), []);
  });
});

describe("findZeroByteFiles", () => {
  it("只报 0 字节且不在白名单的文件", () => {
    const entries = [
      { path: "a.wxml", size: 0 },
      { path: "b.wxml", size: 10 },
      { path: "allowed.txt", size: 0 },
    ];
    assert.deepEqual(
      findZeroByteFiles(entries, { "allowed.txt": "占位文件" }),
      ["a.wxml"],
    );
  });
});

describe("findEmptyDirs", () => {
  it("报空目录，跳过白名单与忽略目录", () => {
    const dirs = [
      "ad2f2beb075e28eed3403e71284c91da",
      ".runtime/trash",
      "miniprogram/static",
      "design-mockups",
    ];
    const result = findEmptyDirs(dirs, {
      allowlist: { "miniprogram/static": "目录由构建填充" },
      ignored: [".runtime", "design-mockups"],
    });
    assert.deepEqual(result, ["ad2f2beb075e28eed3403e71284c91da"]);
  });
});

describe("findDuplicates", () => {
  it("同内容不同路径报重复，小于 1KB 的文件跳过", () => {
    const entries = [
      { path: "static/a.png", size: 2048, hash: "h1" },
      { path: "static/b.png", size: 2048, hash: "h1" },
      { path: "static/c.png", size: 2048, hash: "h2" },
      { path: "component/a.json", size: 20, hash: "same" },
      { path: "component/b.json", size: 20, hash: "same" },
    ];
    const result = findDuplicates(entries, { allowlist: {} });
    assert.deepEqual(result, [["static/a.png", "static/b.png"]]);
  });

  it("白名单里的重复组放过", () => {
    const entries = [
      { path: "x.png", size: 2048, hash: "h1" },
      { path: "y.png", size: 2048, hash: "h1" },
    ];
    assert.deepEqual(
      findDuplicates(entries, { allowlist: { "h1": "同一张占位图" } }),
      [],
    );
  });
});

describe("findOversizeFiles", () => {
  it("超过上限且不在白名单的报出来", () => {
    const entries = [
      { path: "big.zip", size: 3 * 1024 * 1024 },
      { path: "ok.png", size: 1024 },
      { path: "allowed.zip", size: 4 * 1024 * 1024 },
    ];
    assert.deepEqual(
      findOversizeFiles(entries, {
        limit: 2 * 1024 * 1024,
        allowlist: { "allowed.zip": "历史交付物" },
      }),
      ["big.zip"],
    );
  });
});

describe("白名单自身", () => {
  it("v1 的四个白名单均为空（存量已清零）", () => {
    assert.deepEqual(Object.keys(JUNK_ALLOWLIST), []);
    assert.deepEqual(Object.keys(ZERO_BYTE_ALLOWLIST), []);
    assert.deepEqual(Object.keys(EMPTY_DIR_ALLOWLIST), []);
    assert.deepEqual(Object.keys(OVERSIZE_ALLOWLIST), []);
  });

  it("staleAllowlistEntries 能找出已失效条目", () => {
    const allowlist = {
      "gone.png": "文件已删",
      "still.png": "仍然存在",
    };
    assert.deepEqual(
      staleAllowlistEntries(allowlist, new Set(["still.png"])),
      ["gone.png"],
    );
  });

  it("JUNK_PATTERNS 每条都带原因，避免规则裸奔", () => {
    for (const rule of JUNK_PATTERNS) {
      assert.equal(typeof rule.reason, "string");
      assert.ok(rule.reason.length > 0);
    }
  });
});
