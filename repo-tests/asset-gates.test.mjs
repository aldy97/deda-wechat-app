import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FALLBACK_MAX_BYTES,
  validateAssetKeys,
  validateFallbacks,
} from './lib/asset-fallbacks-core.mjs';
import {
  findUncoveredTargets,
  globToRegExp,
} from './lib/coverage-scope-core.mjs';

// 闸口自身的 fixture 测试：闸口逻辑一旦被改坏（正则写错、上限写错、
// 少了某条断言），这里变红，而不是等到线上素材出问题。
// 与 pr-hygiene.test.mjs 同口径：只测纯判定函数，不碰仓库真实文件。

function fakeFs(files) {
  return {
    exists: (relative) => Object.prototype.hasOwnProperty.call(files, relative),
    sizeOf: (relative) => files[relative],
  };
}

function usageOf(overrides = {}) {
  return {
    file: 'miniprogram/pages/demo/demo.wxml',
    assetKey: 'diagnostics/remote-probe',
    fallback: '/static/images/kid-info/logo.png',
    ...overrides,
  };
}

const KNOWN_KEYS = new Set(['diagnostics/remote-probe']);
const VALID_FILES = { 'static/images/kid-info/logo.png': 49_840 };

describe('validateFallbacks', () => {
  it('合法用法返回空错误列表', () => {
    const errors = validateFallbacks([usageOf()], fakeFs(VALID_FILES));
    assert.deepEqual(errors, []);
  });

  it('缺少 fallback 属性 → 报错', () => {
    const errors = validateFallbacks(
      [usageOf({ fallback: null })],
      fakeFs(VALID_FILES),
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /缺少 fallback/);
  });

  it('显式声明 empty-fallback 且 fallback 为空 → 通过（走页面渐变兜底）', () => {
    const errors = validateFallbacks(
      [usageOf({ fallback: '', allowEmpty: true })],
      fakeFs(VALID_FILES),
    );
    assert.deepEqual(errors, []);
  });

  it('empty-fallback 但 fallback 仍有值 → 报错（语义冲突）', () => {
    const errors = validateFallbacks(
      [usageOf({ allowEmpty: true })],
      fakeFs(VALID_FILES),
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /empty-fallback 与 fallback 不能同时存在/);
  });

  it('动态绑定 {{}} → 报错', () => {
    const errors = validateFallbacks(
      [usageOf({ fallback: '/static/{{name}}.png' })],
      fakeFs(VALID_FILES),
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /禁止动态绑定/);
  });

  it('非 /static/ 前缀 → 报错', () => {
    const errors = validateFallbacks(
      [usageOf({ fallback: '/images/logo.png' })],
      fakeFs({ 'images/logo.png': 1024 }),
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /必须以 \/static\/ 开头/);
  });

  it('webp 扩展名 → 报错（iOS 不解码包内 webp）', () => {
    const errors = validateFallbacks(
      [usageOf({ fallback: '/static/images/kid-info/logo.webp' })],
      fakeFs({ 'static/images/kid-info/logo.webp': 1024 }),
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /png\/jpg\/jpeg/);
  });

  it('文件不存在 → 报错', () => {
    const errors = validateFallbacks([usageOf()], fakeFs({}));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /文件不存在/);
  });

  it('超过单图上限 → 报错并带出实际字节数', () => {
    const oversize = { 'static/images/kid-info/logo.png': FALLBACK_MAX_BYTES + 1 };
    const errors = validateFallbacks([usageOf()], fakeFs(oversize));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /超过 204800 上限/);
  });

  it('恰好等于上限 → 通过（边界闭合）', () => {
    const exact = { 'static/images/kid-info/logo.png': FALLBACK_MAX_BYTES };
    assert.deepEqual(validateFallbacks([usageOf()], fakeFs(exact)), []);
  });
});

describe('validateAssetKeys', () => {
  it('已登记 key 返回空错误列表', () => {
    assert.deepEqual(validateAssetKeys([usageOf()], KNOWN_KEYS), []);
  });

  it('缺少 asset-key → 报错', () => {
    const errors = validateAssetKeys([usageOf({ assetKey: null })], KNOWN_KEYS);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /缺少 asset-key/);
  });

  it('未登记 key → 报错并带出 key 名', () => {
    const errors = validateAssetKeys(
      [usageOf({ assetKey: 'elly/unknown' })],
      KNOWN_KEYS,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /elly\/unknown/);
    assert.match(errors[0], /未在 app-asset-keys\.ts 登记/);
  });
});

describe('globToRegExp', () => {
  it('精确路径只匹配自身', () => {
    const re = globToRegExp('miniprogram/utils/app-assets.ts');
    assert.equal(re.test('miniprogram/utils/app-assets.ts'), true);
    assert.equal(re.test('miniprogram/utils/app-assets.spec.ts'), false);
  });

  it('** 跨目录匹配', () => {
    const re = globToRegExp('miniprogram/components/**/*.ts');
    assert.equal(
      re.test('miniprogram/components/elly-image/deep/helper.ts'),
      true,
    );
  });

  it('* 不跨目录', () => {
    const re = globToRegExp('miniprogram/components/*.ts');
    assert.equal(re.test('miniprogram/components/a.ts'), true);
    assert.equal(re.test('miniprogram/components/x/b.ts'), false);
  });

  it('正则元字符被转义（. 不是通配）', () => {
    const re = globToRegExp('a/b.ts');
    assert.equal(re.test('a/bXts'), false);
  });
});

describe('findUncoveredTargets', () => {
  it('全部被覆盖时返回空数组', () => {
    const missing = findUncoveredTargets(
      ['miniprogram/utils/app-assets.ts'],
      ['miniprogram/utils/app-assets.ts'],
    );
    assert.deepEqual(missing, []);
  });

  it('漏登记的素材源文件会被点名', () => {
    const missing = findUncoveredTargets(
      ['miniprogram/utils/app-assets.ts'],
      [
        'miniprogram/utils/app-assets.ts',
        'miniprogram/components/elly-image/elly-image.utils.ts',
      ],
    );
    assert.deepEqual(missing, [
      'miniprogram/components/elly-image/elly-image.utils.ts',
    ]);
  });

  it('空配置时全部素材源都会报缺失', () => {
    const targets = ['a.ts', 'b.ts'];
    assert.deepEqual(findUncoveredTargets([], targets), targets);
  });

  it('通配符覆盖的目录内新文件也算覆盖', () => {
    const missing = findUncoveredTargets(
      ['miniprogram/components/elly-image/**/*.ts'],
      ['miniprogram/components/elly-image/new-file.ts'],
    );
    assert.deepEqual(missing, []);
  });
});
