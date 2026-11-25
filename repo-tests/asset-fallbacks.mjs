import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库级闸口：扫描所有 wxml 中的 <elly-image>，校验 fallback 与 asset-key。
// 零用法也应通过（本闸口只对「已经出现」的用法做断言）。

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MINIPROGRAM_ROOT = path.join(REPO_ROOT, 'miniprogram');
const KEYS_FILE = path.join(
  MINIPROGRAM_ROOT,
  'constants',
  'app-asset-keys.ts',
);
const SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm', 'tests']);

function collectWxmlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectWxmlFiles(full));
    else if (entry.name.endsWith('.wxml')) files.push(full);
  }
  return files;
}

function getAttr(attrs, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m ? m[1] : null;
}

function readKnownKeys() {
  const content = fs.readFileSync(KEYS_FILE, 'utf8');
  const keys = new Set();
  const re = /["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content)) !== null) keys.add(m[1]);
  return keys;
}

function collectUsages() {
  const usages = [];
  for (const file of collectWxmlFiles(MINIPROGRAM_ROOT)) {
    const content = fs.readFileSync(file, 'utf8');
    const re = /<elly-image\b([^>]*)>/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const attrs = m[1] || '';
      const assetKey = getAttr(attrs, 'asset-key') ?? getAttr(attrs, 'assetKey');
      const fallback = getAttr(attrs, 'fallback');
      usages.push({
        file: path.relative(REPO_ROOT, file),
        assetKey,
        fallback,
      });
    }
  }
  return usages;
}

describe('elly-image fallback/asset-key gate', { concurrency: false }, () => {
  let usages;
  let knownKeys;

  before(() => {
    usages = collectUsages();
    knownKeys = readKnownKeys();
  });

  it('fallback 是存在的 /static 文件且非 webp', () => {
    const errors = [];
    for (const usage of usages) {
      const where = usage.file;
      if (!usage.fallback) {
        errors.push(`${where}: <elly-image> 缺少 fallback`);
        continue;
      }
      if (usage.fallback.includes('{{')) {
        errors.push(`${where}: fallback 必须为静态路径，禁止动态绑定`);
        continue;
      }
      if (!usage.fallback.startsWith('/static/')) {
        errors.push(
          `${where}: fallback 必须以 /static/ 开头，实际为 ${usage.fallback}`,
        );
        continue;
      }
      const rel = usage.fallback.replace(/^\/+/, '');
      if (!fs.existsSync(path.join(MINIPROGRAM_ROOT, rel))) {
        errors.push(`${where}: fallback 文件不存在 /${rel}`);
        continue;
      }
      if (path.extname(rel).toLowerCase() === '.webp') {
        errors.push(`${where}: 本地 fallback 不允许 webp`);
      }
    }
    assert.deepEqual(errors, []);
  });

  it('asset-key 已登记在常量表', () => {
    const errors = [];
    for (const usage of usages) {
      const where = usage.file;
      if (!usage.assetKey) {
        errors.push(`${where}: <elly-image> 缺少 asset-key`);
        continue;
      }
      if (!knownKeys.has(usage.assetKey)) {
        errors.push(
          `${where}: asset-key "${usage.assetKey}" 未在 app-asset-keys.ts 登记`,
        );
      }
    }
    assert.deepEqual(errors, []);
  });
});
