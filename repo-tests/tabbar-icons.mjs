import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库级闸口：tabBar 三个底部图标必须真实存在、是合法 PNG、81×81 且 ≤40KB。
// 原生 tabBar 没有运行时 fallback —— 文件一旦漂移（被清理脚本删除 / 路径改错 /
// 体积超限）开发者工具只会显示 broken image，因此把约束前移到 CI。

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MINIPROGRAM_ROOT = path.join(REPO_ROOT, 'miniprogram');
const PNG_SIGNATURE = '89504e470d0a1a0a';
const MAX_BYTES = 40 * 1024;
const EXPECTED_SIZE = 81;

const appJson = JSON.parse(
  fs.readFileSync(path.join(MINIPROGRAM_ROOT, 'app.json'), 'utf8'),
);

const tabs = appJson.tabBar?.list ?? [];

function readPng(relative) {
  const absolute = path.join(MINIPROGRAM_ROOT, relative);
  const buffer = fs.readFileSync(absolute);
  return {
    absolute,
    size: buffer.length,
    signature: buffer.subarray(0, 8).toString('hex'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('tabBar 有三个入口且都声明了普通态与选中态图标', () => {
  assert.equal(tabs.length, 3);

  for (const tab of tabs) {
    assert.equal(typeof tab.text, 'string');
    assert.ok(tab.text.length > 0, 'tab 文案不能为空');
    assert.equal(typeof tab.iconPath, 'string');
    assert.equal(typeof tab.selectedIconPath, 'string');
  }
});

test('tabBar 图标：PNG 签名 / 尺寸 / 体积 / 路径全部合规', () => {
  for (const tab of tabs) {
    for (const key of ['iconPath', 'selectedIconPath']) {
      const relative = tab[key];
      const where = `${tab.text}.${key}`;

      assert.ok(
        !/^https?:\/\//.test(relative),
        `${where} 不能是网络图片，实际为 ${relative}`,
      );

      const png = readPng(relative);
      assert.equal(png.signature, PNG_SIGNATURE, `${where} 不是合法 PNG`);
      assert.equal(
        png.width,
        EXPECTED_SIZE,
        `${where} 宽度应为 ${EXPECTED_SIZE}px，实际 ${png.width}`,
      );
      assert.equal(
        png.height,
        EXPECTED_SIZE,
        `${where} 高度应为 ${EXPECTED_SIZE}px，实际 ${png.height}`,
      );
      assert.ok(
        png.size <= MAX_BYTES,
        `${where} 体积 ${png.size} 字节，超过 ${MAX_BYTES} 上限`,
      );
    }
  }
});
