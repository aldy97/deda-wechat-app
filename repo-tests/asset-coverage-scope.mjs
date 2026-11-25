import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  collectAssetSourceTargets,
  findUncoveredTargets,
} from './lib/coverage-scope-core.mjs';

// 仓库级闸口：素材模块的 100% 覆盖率闸口不允许被悄悄削弱。
// jest.assets.config.js 的 collectCoverageFrom 是白名单制——新增素材源文件
// 却不登记，覆盖率数字照旧 100%，闸口看起来是绿的。这里把范围钉死。
// 判定逻辑在 ./lib/coverage-scope-core.mjs，fixture 测试在 ./asset-gates.test.mjs。

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MINIPROGRAM_ROOT = path.join(REPO_ROOT, 'miniprogram');
const require = createRequire(import.meta.url);

/** 返回目录下所有非 spec、非类型声明的 .ts，路径以仓库根为基准。 */
function listTsFilesUnder(directory) {
  const absolute = path.join(REPO_ROOT, directory);
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const full = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesUnder(path.join(directory, entry.name)));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.d.ts')) continue;
    files.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
  }
  return files;
}

describe('素材覆盖率闸口范围', () => {
  const config = require(path.join(REPO_ROOT, 'jest.assets.config.js'));

  it('collectCoverageFrom 覆盖所有素材源文件', () => {
    const targets = collectAssetSourceTargets(listTsFilesUnder);
    assert.ok(
      targets.length >= 3,
      `素材源文件清单异常（${targets.length} 个），至少应包含 app-assets、elly-image、asset-selftest`,
    );
    assert.deepEqual(findUncoveredTargets(config.collectCoverageFrom, targets), []);
  });

  it('四个维度的 100% 阈值未被下调', () => {
    const global = config.coverageThreshold && config.coverageThreshold.global;
    assert.ok(global, 'jest.assets.config.js 缺少 coverageThreshold.global');
    for (const dimension of ['statements', 'branches', 'functions', 'lines']) {
      assert.equal(global[dimension], 100, `${dimension} 阈值必须为 100`);
    }
  });

  it('覆盖范围仍限定在 miniprogram 内（防止把 node_modules 卷进来）', () => {
    for (const pattern of config.collectCoverageFrom) {
      assert.match(pattern, /^miniprogram\//, `${pattern} 必须位于 miniprogram/ 下`);
    }
  });

  it('素材目录本身存在（改名/搬移会在此提示）', () => {
    assert.ok(fs.existsSync(path.join(MINIPROGRAM_ROOT, 'utils', 'app-assets.ts')));
    assert.ok(fs.existsSync(path.join(MINIPROGRAM_ROOT, 'components', 'elly-image')));
    assert.ok(fs.existsSync(path.join(MINIPROGRAM_ROOT, 'pages', 'asset-selftest')));
  });
});
