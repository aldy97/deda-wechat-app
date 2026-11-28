// any 闸口的纯判定逻辑。
// 用 TypeScript 编译器 API 数显式 any —— 注释、字符串、anyValue 这类标识符
// 都不会误报，正则做不到这一点。

import ts from "typescript";

/**
 * 统计一段源码里显式 any 的个数。
 * 覆盖 `: any`、`as any`、`<any>`、`Array<any>`、`Record<string, any>`、
 * `any[]`、索引签名等全部语法位置。
 */
export function countAnyInSource(source, fileName = "input.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let count = 0;
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) count += 1;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

/**
 * 校验每个文件的 any 数与配额。
 * 规则（与 static-assets 白名单同口径，burn-down 单向）：
 *   - 未登记且 > 0  → 报错（生产代码必须为 0）
 *   - actual > max  → 报错（新增 any）
 *   - actual < max  → 报错（要求同步下调，防止白名单腐烂）
 *   - 白名单条目文件不存在 / 已归零 → 报错
 *
 * @param {Map<string, number>} counts 相对仓库根的路径 → any 数
 * @param {Record<string, {max: number, reason: string}>} allowlist
 * @returns {string[]}
 */
export function checkQuota(counts, allowlist) {
  const errors = [];
  const sortedPaths = [...counts.keys()].sort();

  for (const relPath of sortedPaths) {
    const actual = counts.get(relPath);
    const entry = allowlist[relPath];
    if (!entry) {
      errors.push(`${relPath}：${actual} 处 any（生产代码不允许 any）`);
      continue;
    }
    if (actual > entry.max) {
      errors.push(
        `${relPath}：${actual} 处 any，超出配额 ${entry.max}（只降不升）`,
      );
    } else if (actual < entry.max) {
      errors.push(
        `${relPath}：${actual} 处 any，低于配额 ${entry.max}，请下调配额到 ${actual}`,
      );
    }
  }

  for (const relPath of Object.keys(allowlist).sort()) {
    if (!counts.has(relPath)) {
      errors.push(`${relPath}：白名单条目对应文件不存在，请删除该条目`);
      continue;
    }
    if (counts.get(relPath) === 0) {
      errors.push(`${relPath}：any 已清零，请删除白名单条目`);
    }
  }

  return errors;
}

/** 按 miniprogram/<目录> 汇总，保持首次出现顺序，便于报告 */
export function summarizeCounts(counts) {
  const summary = new Map();
  for (const [relPath, count] of counts) {
    const key = relPath.split("/").slice(0, 2).join("/");
    summary.set(key, (summary.get(key) || 0) + count);
  }
  return [...summary.entries()];
}
