// 素材覆盖率闸口的纯判定逻辑：
// 1) 把 collectCoverageFrom 的 glob 转成正则，判断某个源文件是否被统计覆盖；
// 2) 声明「素材源文件」的范围，供闸口枚举后逐个核对。

/** 素材模块必须 100% 覆盖的源文件（精确路径）。 */
export const ASSET_SOURCE_FILES = ["miniprogram/utils/app-assets.ts"];

/** 素材模块必须 100% 覆盖的目录，目录内所有非 spec 的 .ts 都算。 */
export const ASSET_SOURCE_DIRS = [
  "miniprogram/components/elly-image",
  "miniprogram/pages/asset-selftest",
];

/**
 * 把 jest collectCoverageFrom 支持的简单 glob 转成正则。
 * 只实现本项目用到的两种通配：`**` 跨目录、`*` 不跨目录；其余字符一律转义。
 */
export function globToRegExp(pattern) {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        // `**/` 连同后面的斜杠一起吸收，避免要求存在多余空目录
        if (pattern[index + 2] === "/") {
          source += "(?:.*/)?";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    source += /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
  }
  return new RegExp(`^${source}$`);
}

/** 返回 targets 中没有被 collectCoverageFrom 任何一条 glob 命中的文件。 */
export function findUncoveredTargets(collectCoverageFrom, targets) {
  const matchers = (collectCoverageFrom || []).map((pattern) =>
    globToRegExp(pattern),
  );
  return targets.filter(
    (target) => !matchers.some((matcher) => matcher.test(target)),
  );
}

/**
 * 汇总素材源文件清单。
 * listFilesUnder(dir) 由调用方注入，返回该目录下所有非 spec 的 .ts 相对路径。
 */
export function collectAssetSourceTargets(listFilesUnder) {
  const fromDirectories = ASSET_SOURCE_DIRS.flatMap((directory) =>
    listFilesUnder(directory),
  );
  return [...ASSET_SOURCE_FILES, ...fromDirectories].sort();
}
