// 打包体积闸口的纯判定逻辑：
// 1) 复刻微信开发者工具 project.config.json > packOptions.ignore 的匹配语义，
//    算出「哪些文件真的会进包」；
// 2) 体积上界 = 进包源文件字节数之和。开发者工具上传前还会压缩 JS/WXML/WXSS，
//    所以这个和是上界：上界不超 2MB 就一定不会触发 80051；
// 3) 包里不得混入测试、示例截图、Finder 副本等无用文件。

export const MAIN_PACKAGE_LIMIT = 2 * 1024 * 1024;
export const SUBPACKAGE_LIMIT = 2 * 1024 * 1024;

/** packOptions.ignore 必须覆盖的条目（缺一条闸口就红） */
export const REQUIRED_IGNORE_RULES = [
  { type: "folder", value: "tests" },
  { type: "suffix", value: ".spec.js" },
  { type: "suffix", value: ".spec.ts" },
  { type: "suffix", value: ".DS_Store" },
  { type: "folder", value: "static/images/exmaples" },
];

/** 非运行时代码：开发者工具用 TypeScript 编译插件从 .ts 产出 .js，.ts 本身不上传 */
const NOT_SHIPPED_EXTENSIONS = [".ts"];

/**
 * 单条 ignore 规则的匹配（路径为相对 miniprogramRoot 的 posix 路径）。
 * 未识别的 type 直接抛错，避免规则写错时静默放过。
 */
export function matchesIgnore(relPath, rule) {
  const { type, value } = rule;
  const name = relPath.split("/").pop();

  switch (type) {
    case "folder": {
      if (value.includes("/")) {
        return relPath === value || relPath.startsWith(`${value}/`);
      }
      if (relPath === value) return true;
      const segments = relPath.split("/");
      segments.pop();
      return segments.includes(value);
    }
    case "file":
      return name === value || relPath === value;
    case "suffix":
      return relPath.endsWith(value);
    case "prefix":
      return relPath.startsWith(value);
    case "regexp":
      return new RegExp(value).test(relPath);
    default:
      throw new Error(`不支持的 packOptions.ignore 类型：${type}`);
  }
}

export function isIgnored(relPath, rules) {
  return rules.some((rule) => matchesIgnore(relPath, rule));
}

export function collectPackedFiles(files, rules) {
  return files.filter((relPath) => !isIgnored(relPath, rules));
}

export function isShippedCode(relPath) {
  return !NOT_SHIPPED_EXTENSIONS.some((ext) => relPath.endsWith(ext));
}

export function sumBytes(entries) {
  return entries.reduce((total, entry) => total + entry.size, 0);
}

/** 必备 ignore 规则里缺了哪些（供闸口把「缺什么」打出来） */
export function missingRequiredRules(rules, required = REQUIRED_IGNORE_RULES) {
  return required
    .filter(
      (need) =>
        !rules.some(
          (rule) => rule.type === need.type && rule.value === need.value,
        ),
    )
    .map((rule) => `${rule.type}:${rule.value}`);
}

const HYGIENE_CHECKS = [
  {
    reason: "测试源码/产物不进包（packOptions.ignore 未生效）",
    test: (relPath) =>
      relPath.endsWith(".spec.js") || relPath.endsWith(".spec.ts"),
  },
  {
    reason: "tests 目录不进包（packOptions.ignore 未生效）",
    test: (relPath) => relPath === "tests" || relPath.startsWith("tests/"),
  },
  {
    reason: "macOS 元数据不进包",
    test: (relPath) => relPath.split("/").pop() === ".DS_Store",
  },
  {
    reason: "Finder 重复副本（* 2.png 之类）不进包",
    test: (relPath) =>
      / \d+\.(png|jpe?g|webp|gif|svg|ts|js|wxml|wxss|json)$/.test(relPath),
  },
  {
    reason: "示例截图不属于小程序资源",
    test: (relPath) => relPath.startsWith("static/images/exmaples/"),
  },
];

/** 返回进包文件里违反卫生规则的那些（附原因） */
export function findPackageViolations(packedFiles) {
  const violations = [];
  for (const relPath of packedFiles) {
    for (const check of HYGIENE_CHECKS) {
      if (check.test(relPath)) {
        violations.push(`${relPath}：${check.reason}`);
        break;
      }
    }
  }
  return violations;
}

/** 某个目录前缀下（含自身）的进包文件字节和 */
export function packageBytes(entries, root = "") {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const scoped = entries.filter((entry) =>
    prefix ? entry.path.startsWith(prefix) || entry.path === root : true,
  );
  return sumBytes(scoped);
}
