#!/usr/bin/env node
/** 从 miniprogram/styles/palette.wxss 同步不支持 CSS 变量的原生颜色配置。 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const palettePath = path.join(root, "miniprogram/styles/palette.wxss");
const appJsonPath = path.join(root, "miniprogram/app.json");
const palette = fs.readFileSync(palettePath, "utf8");
const definitions = new Map();

for (const match of palette.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
  definitions.set(match[1], match[2].trim());
}

function resolve(name, seen = new Set()) {
  const value = definitions.get(name);
  if (!value) throw new Error(`色板缺少 --${name}`);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (!reference) return value;
  if (seen.has(name)) throw new Error(`色板循环引用：--${name}`);
  seen.add(name);
  return resolve(reference[1], seen);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
appJson.window.navigationBarBackgroundColor = resolve("color-nav-bg");
appJson.tabBar.color = resolve("color-tab-text");
appJson.tabBar.selectedColor = resolve("color-tab-active");
appJson.tabBar.backgroundColor = resolve("color-tab-bg");
fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);

const canvasColors = Array.from({ length: 6 }, (_, index) =>
  resolve(`color-mode-${index + 1}`),
);
// 手写对象字面量而非 JSON.stringify：JSON 会加引号且不带尾逗号，
// 与 prettier 格式冲突，导致每次 npm run build 都把 palette.ts 改脏
const canvasUiEntries = [
  ["surface", resolve("color-surface")],
  ["text", resolve("color-text")],
  ["primary", resolve("color-primary")],
]
  .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
  .join("\n");
const paletteTsPath = path.join(root, "miniprogram/styles/palette.ts");
const paletteTs = `/** 由 scripts/sync-palette.js 从 palette.wxss 生成，仅供 Canvas 使用。 */
export const CANVAS_MODE_COLORS = [
${canvasColors.map((color) => `  ${JSON.stringify(color)},`).join("\n")}
];

export const CANVAS_UI_COLORS = {
${canvasUiEntries}
} as const;
`;
fs.writeFileSync(paletteTsPath, paletteTs);
console.log("已从唯一色板同步 app.json 与 Canvas 色板");
