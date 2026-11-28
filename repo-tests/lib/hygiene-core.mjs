// 仓库卫生闸口的纯判定逻辑：垃圾命名、0 字节文件、空目录、重复内容、超大文件。
// 与文件系统解耦：扫描由 hygiene.mjs 负责，这里只做判定，便于 fixture 测试。

/**
 * 垃圾文件名规则。每条都必须带原因，避免匿名正则。
 * 匹配的是「文件名」，不是完整路径。
 */
export const JUNK_PATTERNS = [
  { reason: "macOS 目录元数据", test: (name) => name === ".DS_Store" },
  { reason: "macOS AppleDouble 资源分叉", test: (name) => name.startsWith("._") },
  { reason: "Office 临时锁文件", test: (name) => name.startsWith("~$") },
  {
    reason: "Finder 重复副本（空格+数字）",
    test: (name) => / \d+\.[A-Za-z0-9]+$/.test(name),
  },
  {
    reason: "Finder 重复副本（copy）",
    test: (name) => / copy\.[A-Za-z0-9]+$/i.test(name),
  },
  {
    reason: "Finder 重复副本（副本）",
    test: (name) => /副本(?:\s\d+)?\.[A-Za-z0-9]+$/.test(name),
  },
];

export function isJunkName(relPath) {
  const name = relPath.split("/").pop();
  return JUNK_PATTERNS.some((rule) => rule.test(name));
}

export function findJunkNames(paths) {
  return paths.filter(isJunkName);
}

/** entries: { path, size } */
export function findZeroByteFiles(entries, allowlist = {}) {
  return entries
    .filter((entry) => entry.size === 0 && !(entry.path in allowlist))
    .map((entry) => entry.path);
}

/** dirs: 相对路径；ignored 前缀内的目录整段跳过 */
export function findEmptyDirs(dirs, { allowlist = {}, ignored = [] } = {}) {
  const isIgnored = (dir) =>
    ignored.some((prefix) => dir === prefix || dir.startsWith(`${prefix}/`));
  return dirs.filter(
    (dir) => !isIgnored(dir) && !(dir in allowlist),
  );
}

/** entries: { path, size, hash }；同 size 且同 hash 才算重复，小于 1KB 跳过 */
export function findDuplicates(entries, { allowlist = {} } = {}) {
  const MIN_BYTES = 1024;
  const buckets = new Map();
  for (const entry of entries) {
    if (entry.size < MIN_BYTES || !entry.hash) continue;
    const key = `${entry.size}:${entry.hash}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry.path);
  }

  const duplicates = [];
  for (const [key, paths] of buckets) {
    if (paths.length < 2) continue;
    const hash = key.split(":")[1];
    if (hash in allowlist) continue;
    duplicates.push(paths.sort());
  }
  return duplicates.sort((a, b) => a[0].localeCompare(b[0]));
}

/** entries: { path, size } */
export function findOversizeFiles(entries, { limit, allowlist = {} }) {
  return entries
    .filter((entry) => entry.size > limit && !(entry.path in allowlist))
    .map((entry) => entry.path);
}

/** 白名单里「文件已不存在」的条目必须清掉，否则白名单会无声腐烂 */
export function staleAllowlistEntries(allowlist, existingPaths) {
  return Object.keys(allowlist).filter((path) => !existingPaths.has(path));
}
