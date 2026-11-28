import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  checkQuota,
  countAnyInSource,
  summarizeCounts,
} from "./lib/any-guard-core.mjs";

// 闸口自身 fixture：AST 判定写错时这里先红。
// 注意：注释与字符串里的 "any" 不算，标识符 anyValue 也不算 —— 正则做不到，
// 所以这里用 TypeScript 编译器 API。

describe("countAnyInSource", () => {
  it("各类显式 any 都计数：注解、断言、泛型实参、数组、索引签名", () => {
    const source = `
      const a: any = 1;
      const b = x as any;
      const c = <any>x;
      const d: Array<any> = [];
      const e: Record<string, any> = {};
      const f: any[] = [];
      const g: Promise<any> = null as never;
      interface Box { [key: string]: any }
    `;
    assert.equal(countAnyInSource(source), 8);
  });

  it("注释、字符串、标识符里的 any 不误报", () => {
    const source = `
      // 这里不该用 any
      /* any any any */
      const label = "any";
      const anyValue = 1;
      function anything(): unknown { return null; }
    `;
    assert.equal(countAnyInSource(source), 0);
  });

  it("unknown / never / void 不计入", () => {
    const source = `
      function f(x: unknown): unknown { return x; }
      function g(): void {}
      type T = never;
    `;
    assert.equal(countAnyInSource(source), 0);
  });
});

describe("checkQuota", () => {
  it("生产文件出现 any 即报错（不登记配额）", () => {
    const errors = checkQuota(new Map([["miniprogram/utils/a.ts", 2]]), {});
    assert.equal(errors.length, 1);
    assert.match(errors[0], /2 处 any/);
  });

  it("配额内通过，超配额报错", () => {
    const allowlist = { "miniprogram/tests/h.ts": { max: 3, reason: "harness" } };
    assert.deepEqual(
      checkQuota(new Map([["miniprogram/tests/h.ts", 3]]), allowlist),
      [],
    );
    const errors = checkQuota(
      new Map([["miniprogram/tests/h.ts", 4]]),
      allowlist,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /超出配额 3/);
  });

  it("实际数量低于配额也报错（要求同步下调，burn-down 单向）", () => {
    const allowlist = { "miniprogram/tests/h.ts": { max: 5, reason: "harness" } };
    const errors = checkQuota(
      new Map([["miniprogram/tests/h.ts", 2]]),
      allowlist,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /低于配额 5/);
  });

  it("白名单条目文件不存在或已归零，都报错", () => {
    const allowlist = {
      "miniprogram/tests/gone.ts": { max: 2, reason: "harness" },
    };
    const errors = checkQuota(new Map(), allowlist);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /文件不存在/);
  });
});

describe("summarizeCounts", () => {
  it("按目录汇总，便于报告", () => {
    const summary = summarizeCounts(
      new Map([
        ["miniprogram/utils/a.ts", 2],
        ["miniprogram/pages/b/b.ts", 3],
        ["miniprogram/tests/h.ts", 1],
      ]),
    );
    assert.deepEqual(summary, [
      ["miniprogram/utils", 2],
      ["miniprogram/pages", 3],
      ["miniprogram/tests", 1],
    ]);
  });
});
