import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_IGNORE_RULES,
  collectPackedFiles,
  findPackageViolations,
  isIgnored,
  matchesIgnore,
  missingRequiredRules,
  packageBytes,
} from "./lib/package-size-core.mjs";

// 闸口自身的 fixture 测试：ignore 匹配语义或卫生规则被改坏时，
// 这里先红，而不是等到真机上传报 80051。
// 与 asset-gates.test.mjs 同口径：只测纯判定函数，不碰仓库真实文件。

describe("matchesIgnore", () => {
  it("folder：匹配目录自身与后代，不匹配同名前缀目录", () => {
    const rule = { type: "folder", value: "tests" };
    assert.equal(matchesIgnore("tests/a.spec.js", rule), true);
    assert.equal(matchesIgnore("tests", rule), true);
    assert.equal(matchesIgnore("tests2/a.js", rule), false);
    assert.equal(matchesIgnore("pages/a.js", rule), false);
  });

  it("folder：带斜杠的 value 按相对路径前缀匹配", () => {
    const rule = { type: "folder", value: "static/images/exmaples" };
    assert.equal(matchesIgnore("static/images/exmaples/a.PNG", rule), true);
    assert.equal(matchesIgnore("static/images/a.png", rule), false);
  });

  it("suffix / file / prefix / regexp 各自生效", () => {
    assert.equal(matchesIgnore("pages/a.spec.js", { type: "suffix", value: ".spec.js" }), true);
    assert.equal(matchesIgnore("pages/a.js", { type: "suffix", value: ".spec.js" }), false);
    assert.equal(matchesIgnore("static/.DS_Store", { type: "file", value: ".DS_Store" }), true);
    assert.equal(matchesIgnore("static/a.png", { type: "prefix", value: "static/" }), true);
    assert.equal(
      matchesIgnore("pages/a/a.js", { type: "regexp", value: "\\.spec\\." }),
      false,
    );
  });

  it("未知 type 直接抛错，避免规则写错静默放过", () => {
    assert.throws(
      () => matchesIgnore("a.js", { type: "magic", value: "x" }),
      /不支持的 packOptions\.ignore 类型/,
    );
  });
});

describe("collectPackedFiles / findPackageViolations", () => {
  const rules = REQUIRED_IGNORE_RULES;

  it("必备规则覆盖测试与截图", () => {
    const files = [
      "app.js",
      "tests/static-assets.spec.js",
      "pages/a/a.spec.js",
      "pages/a/a.spec.ts",
      "static/.DS_Store",
      "static/images/exmaples/x.PNG",
      "static/images/logo.png",
    ];
    assert.deepEqual(collectPackedFiles(files, rules), [
      "app.js",
      "static/images/logo.png",
    ]);
  });

  it("Finder 重复副本即使没被 ignore 也要被卫生规则拦下", () => {
    const violations = findPackageViolations([
      "static/images/avatar_boy 2.png",
      "static/images/avatar_boy 12.png",
      "static/images/avatar_boy.png",
    ]);
    assert.equal(violations.length, 2);
    assert.match(violations[0], /Finder 重复副本/);
  });

  it("测试产物 / .DS_Store 未被 ignore 时同样报违规", () => {
    const violations = findPackageViolations([
      "pages/a/a.spec.js",
      "static/.DS_Store",
      "app.js",
    ]);
    assert.equal(violations.length, 2);
  });
});

describe("missingRequiredRules / packageBytes", () => {
  it("缺条目时列出 type:value", () => {
    assert.deepEqual(missingRequiredRules([]), [
      "folder:tests",
      "suffix:.spec.js",
      "suffix:.spec.ts",
      "suffix:.DS_Store",
      "folder:static/images/exmaples",
    ]);
  });

  it("条目齐全时返回空", () => {
    assert.deepEqual(missingRequiredRules(REQUIRED_IGNORE_RULES), []);
  });

  it("packageBytes 只统计指定目录前缀", () => {
    const entries = [
      { path: "app.js", size: 10 },
      { path: "packages/manual/user-manual/user-manual.js", size: 20 },
      { path: "packages/manual/static/manual.jpg", size: 30 },
    ];
    assert.equal(packageBytes(entries), 60);
    assert.equal(packageBytes(entries, "packages/manual"), 50);
  });

  it("isIgnored 对空规则集恒为 false", () => {
    assert.equal(isIgnored("app.js", []), false);
  });
});
