/**
 * 展示位 key 注册表 guard。
 *
 * 服务端的展示位可以自助新增，但小程序侧的 key 仍是编译期常量：
 * 这里焊死「登记了就必须接线」，防止注册表里出现永远不会有页面消费的
 * 死 key，也防止 key 格式/标签漂移。
 */
export {};

declare const __dirname: string;
const fs = require("fs");
const path = require("path");
const {
  APP_ASSET_KEYS,
  APP_ASSET_LABELS,
} = require("../constants/app-asset-keys");

const MINIPROGRAM_ROOT = path.resolve(__dirname, "..");
const KEY_PATTERN = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;
const KEYS: string[] = Object.values(APP_ASSET_KEYS);
const KEY_REGISTRY_FILE = "constants/app-asset-keys.ts";

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "miniprogram_npm" || entry.name === "vendor") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else {
      result.push(full);
    }
  }
  return result;
}

function relative(file: string): string {
  return path.relative(MINIPROGRAM_ROOT, file).split(path.sep).join("/");
}

const ALL_FILES = walk(MINIPROGRAM_ROOT);
const ALL_WXML = ALL_FILES.filter((file) => file.endsWith(".wxml"));
const CONSUMERS = ALL_FILES.filter((file) => {
  const name = relative(file);
  return (
    /\.(ts|wxml)$/.test(name) &&
    !name.endsWith(".spec.ts") &&
    name !== KEY_REGISTRY_FILE
  );
});

describe("展示位 key 注册表", () => {
  it("key 格式统一为 page/suffix 且不重复", () => {
    for (const key of KEYS) {
      expect(key).toMatch(KEY_PATTERN);
    }
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  it("每个 key 都有中文标签", () => {
    expect(Object.keys(APP_ASSET_LABELS).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      expect(APP_ASSET_LABELS[key].length).toBeGreaterThan(0);
    }
  });

  it("每个 key 至少被一处非注册表代码引用（防止死 key）", () => {
    for (const key of KEYS) {
      const used = CONSUMERS.some((file) =>
        fs.readFileSync(file, "utf8").includes(key),
      );
      expect({ key, used }).toEqual({ key, used: true });
    }
  });

  it("业务 key 的 page 前缀对应真实页面目录", () => {
    for (const key of KEYS) {
      if (key.startsWith("diagnostics/")) continue;
      const page = key.split("/")[0];
      const wxml = path.join(MINIPROGRAM_ROOT, "pages", page, `${page}.wxml`);
      expect({ key, wxml: fs.existsSync(wxml) }).toEqual({
        key,
        wxml: true,
      });
    }
  });

  it("诊断探针只保留在素材自检页", () => {
    const hits = ALL_WXML.filter((file) =>
      fs.readFileSync(file, "utf8").includes("diagnostics/remote-probe"),
    ).map(relative);
    expect(hits).toEqual(["pages/asset-selftest/asset-selftest.wxml"]);
  });
});
