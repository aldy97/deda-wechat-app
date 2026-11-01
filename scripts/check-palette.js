#!/usr/bin/env node
/** 检查业务源码直接色值、未定义变量以及原生配置同步状态。 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniRoot = path.join(root, "miniprogram");
const palettePath = path.join(miniRoot, "styles/palette.wxss");
const errors = [];
const definitions = new Set();
const references = [];
const extensions = new Set([".wxss", ".wxml", ".ts", ".js", ".json"]);

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "miniprogram_npm") continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extensions.has(path.extname(entry.name))) checkFile(file);
  }
}

function checkFile(file) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(/--([\w-]+)\s*:/g)) {
    definitions.add(match[1]);
  }
  for (const match of content.matchAll(/var\(--([\w-]+)/g)) {
    references.push({ name: match[1], file: relative });
  }

  if (
    file === palettePath ||
    file === path.join(miniRoot, "styles/palette.ts") ||
    file === path.join(miniRoot, "styles/palette.js") ||
    file === path.join(miniRoot, "app.json")
  )
    return;
  const directColor = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
  for (const match of content.matchAll(directColor)) {
    const line = content.slice(0, match.index).split("\n").length;
    errors.push(`${relative}:${line} 存在分散色值 ${match[0]}`);
  }
}

walk(miniRoot);
for (const reference of references) {
  if (!definitions.has(reference.name)) {
    errors.push(`${reference.file} 引用了未定义变量 --${reference.name}`);
  }
}

const palette = fs.readFileSync(palettePath, "utf8");
const paletteValues = new Map();
for (const match of palette.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
  paletteValues.set(match[1], match[2].trim());
}
function resolve(name, seen = new Set()) {
  const value = paletteValues.get(name);
  if (!value) return null;
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (!reference) return value;
  if (seen.has(name)) return null;
  seen.add(name);
  return resolve(reference[1], seen);
}

const appJson = JSON.parse(
  fs.readFileSync(path.join(miniRoot, "app.json"), "utf8"),
);
const nativeExpectations = [
  [
    "window.navigationBarBackgroundColor",
    appJson.window.navigationBarBackgroundColor,
    resolve("color-nav-bg"),
  ],
  ["tabBar.color", appJson.tabBar.color, resolve("color-tab-text")],
  [
    "tabBar.selectedColor",
    appJson.tabBar.selectedColor,
    resolve("color-tab-active"),
  ],
  [
    "tabBar.backgroundColor",
    appJson.tabBar.backgroundColor,
    resolve("color-tab-bg"),
  ],
];
for (const [name, actual, expected] of nativeExpectations) {
  if (actual !== expected) {
    errors.push(`app.json ${name} 与色板不同步：${actual}，应为 ${expected}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("调色盘检查通过：无分散色值，变量均已定义，原生配置已同步");
