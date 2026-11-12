/**
 * 小程序 npm 模块解析 guard（集成测试层）。
 *
 * 事故背景：monitor.ts 曾在模块顶层 `import X = require("@arms/js-sdk/miniapp")`。
 * jest 用 Node 解析器能在 node_modules 里找到该文件，全套测试绿灯；
 * 但微信运行时只认 miniprogram_npm，而开发者工具「构建 npm」仅按 package.json 的
 * main 打出 miniprogram_npm/@arms/js-sdk/index.js（且那是浏览器 BrowserLogger），
 * 子路径 miniapp.js 根本不存在 → 加载期抛 "module is not defined" →
 * request.ts → app.ts → App() 全链路失败 → 所有页面未注册 + 组件解析成 wx://not-found。
 *
 * 本 guard 把这条「jest 绿 / 真机白屏」的盲区永久焊死，两条不变量：
 *   1. 出货源码中，模块加载期执行的裸包名 require 必须在 KNOWN_LOAD_TIME_NPM 白名单内
 *      （白名单当前为空，新增顶层 npm 依赖必须经过评审显式登记）；
 *   2. 凡在 miniprogram_npm 下解析不到的裸包名，只能出现在「函数内 + try 内」的
 *      懒加载位置，并且必须在 KNOWN_LAZY_UNRESOLVED 里登记原因。
 *
 * 第 2 条依赖 miniprogram_npm（gitignore 的本地目录，由开发者工具「构建 npm」生成，
 * CI 上不存在），因此该组用例在目录缺失时整体 skip，不阻断发布闸口。
 */

declare const __dirname: string;

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const MINIPROGRAM_ROOT = path.join(__dirname, "..");
const NPM_DIR = path.join(MINIPROGRAM_ROOT, "miniprogram_npm");

/**
 * 允许出现在模块加载期（顶层）的裸包名。
 * 必须保持为空：顶层 require 一旦在 miniprogram_npm 里缺失就是全站白屏，
 * 新增依赖请改走「函数内 + try/catch」懒加载并登记到 KNOWN_LAZY_UNRESOLVED。
 * 白名单只允许减少，不允许新增。
 */
const KNOWN_LOAD_TIME_NPM: string[] = [];

/**
 * 已知「懒加载 + try 兜底」且在 miniprogram_npm 下解析不到的裸包名，必须写明原因。
 * 白名单只允许减少，不允许新增。
 */
const KNOWN_LAZY_UNRESOLVED: Record<string, string> = {
  "@arms/js-sdk/miniapp":
    "ARMS 应用尚未创建（config/monitor.config.ts 的 ARMS_PID 为空字符串），监控整体不启用。" +
    "@arms/js-sdk 已从 package.json 移除：它的「构建 npm」产物只有 89KB 的浏览器 " +
    "BrowserLogger（含 window 引用），小程序里既用不到也跑不了，纯占主包体积；" +
    "子路径 miniapp.js 本来就不会被生成。类型仍由 types/arms-js-sdk.d.ts 的环境声明提供，" +
    "tsc 不依赖该包真实安装（已验证 --noEmit 通过）。" +
    "monitor.ts 在 loadSdk() 内 try/catch 懒加载，模块缺失即降级为全 no-op，不影响启动。" +
    "正式启用 ARMS 需三步：装回依赖 + 补 vendor 打包（browserify 闭包 11 文件 / 59KB，" +
    "放进 miniprogram/vendor/ 并在 .gitignore 加 !miniprogram/vendor/ 豁免，" +
    "否则会被 miniprogram/**.js 与 guard:no-js 一起剔掉）+ 填入 ARMS_PID，" +
    "完成后移除本条目。",
};

/** 裸包名 require 的两种位置语义 */
type RequireKind = "load-time" | "lazy";

interface BareRequire {
  specifier: string;
  kind: RequireKind;
  file: string;
  line: number;
}

/** 递归收集出货源码 .ts（排除测试代码、类型声明与依赖目录） */
function collectShippedSources(): string[] {
  const SKIP_DIRS = new Set(["node_modules", "miniprogram_npm", "tests"]);
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      if (entry.name.endsWith(".spec.ts")) continue;
      results.push(full);
    }
  }

  walk(MINIPROGRAM_ROOT);
  return results;
}

/** 裸包名 = 不以 . 或 / 开头的 specifier（相对路径与绝对路径由微信按文件树解析，不受本 guard 约束） */
function isBareSpecifier(specifier: string): boolean {
  return !specifier.startsWith(".") && !specifier.startsWith("/");
}

function isFunctionLike(node: any): boolean {
  return (
    node.kind === ts.SyntaxKind.FunctionDeclaration ||
    node.kind === ts.SyntaxKind.FunctionExpression ||
    node.kind === ts.SyntaxKind.ArrowFunction ||
    node.kind === ts.SyntaxKind.MethodDeclaration ||
    node.kind === ts.SyntaxKind.GetAccessor ||
    node.kind === ts.SyntaxKind.SetAccessor ||
    node.kind === ts.SyntaxKind.Constructor
  );
}

/** 从字符串字面量节点取文本，非字符串字面量返回 null（动态 require 不在本 guard 覆盖范围） */
function literalText(node: any): string | null {
  return node && node.kind === ts.SyntaxKind.StringLiteral ? node.text : null;
}

/**
 * 遍历单个源文件，收集所有裸包名 require 及其位置语义。
 * ctx.inTry 仅对 TryStatement 的 try 块内为 true（catch/finally 不算被保护）。
 * 进入函数时重置 inTry：外层 try 不保护异步/延迟调用的函数体。
 */
function collectBareRequires(file: string): BareRequire[] {
  const source = fs.readFileSync(file, "utf-8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ES2015,
    true,
  );
  const found: BareRequire[] = [];
  const rel = path.relative(MINIPROGRAM_ROOT, file);

  function record(specifier: string, node: any, kind: RequireKind): void {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    found.push({ specifier, kind, file: rel, line: line + 1 });
  }

  function visit(
    node: any,
    ctx: { inFunction: boolean; inTry: boolean },
  ): void {
    // import X from "pkg" / import { a } from "pkg" / import "pkg"
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const specifier = literalText(node.moduleSpecifier);
      const typeOnly =
        (node.importClause && node.importClause.isTypeOnly) || false;
      if (specifier && isBareSpecifier(specifier) && !typeOnly) {
        record(specifier, node, "load-time");
      }
    }

    // import X = require("pkg")：CommonJS 下必产出顶层 require，永远是加载期
    if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
      const ref = node.moduleReference;
      if (ref && ref.kind === ts.SyntaxKind.ExternalModuleReference) {
        const specifier = literalText(ref.expression);
        if (specifier && isBareSpecifier(specifier)) {
          record(specifier, node, "load-time");
        }
      }
    }

    // require("pkg") 裸调用：位置决定是否加载期
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.Identifier &&
      node.expression.text === "require"
    ) {
      const specifier = literalText(node.arguments[0]);
      if (specifier && isBareSpecifier(specifier)) {
        record(
          specifier,
          node,
          ctx.inFunction && ctx.inTry ? "lazy" : "load-time",
        );
      }
    }

    if (isFunctionLike(node)) {
      ts.forEachChild(node, (child: any) =>
        visit(child, { inFunction: true, inTry: false }),
      );
      return;
    }

    if (node.kind === ts.SyntaxKind.TryStatement) {
      visit(node.tryBlock, { inFunction: ctx.inFunction, inTry: true });
      if (node.catchClause) visit(node.catchClause, ctx);
      if (node.finallyBlock) visit(node.finallyBlock, ctx);
      return;
    }

    ts.forEachChild(node, (child: any) => visit(child, ctx));
  }

  ts.forEachChild(sourceFile, (child: any) =>
    visit(child, { inFunction: false, inTry: false }),
  );
  return found;
}

/** 微信运行时解析规则：miniprogram_npm/<specifier>.js 或 miniprogram_npm/<specifier>/index.js */
function resolvesInMiniprogramNpm(specifier: string): boolean {
  const base = path.join(NPM_DIR, specifier);
  return (
    fs.existsSync(`${base}.js`) ||
    fs.existsSync(path.join(base, "index.js")) ||
    fs.existsSync(`${base}.json`)
  );
}

// 注：tsconfig 的 lib 未含 ES2019，不能用 Array.prototype.flatMap
const ALL_REQUIRES: BareRequire[] = [];
for (const file of collectShippedSources()) {
  for (const item of collectBareRequires(file)) ALL_REQUIRES.push(item);
}

describe("出货源码的裸包名 require 位置约束（不依赖 miniprogram_npm，CI 也生效）", () => {
  it("模块加载期的裸包名 require 仅限白名单（白名单当前为空）", () => {
    const violations = ALL_REQUIRES.filter(
      (item) =>
        item.kind === "load-time" &&
        !KNOWN_LOAD_TIME_NPM.includes(item.specifier),
    ).map((item) => `${item.file}:${item.line} require("${item.specifier}")`);

    expect(violations).toEqual([]);
  });

  it("懒加载的裸包名 require 必须被 try 包裹（否则降级承诺不成立）", () => {
    // 由 collectBareRequires 的判定可知：kind === "lazy" 已蕴含「函数内 + try 内」，
    // 这里反向锁定——凡是函数内但不在 try 里的裸包名 require 会被判为 load-time，
    // 从而被上一条用例拦截。本条确保白名单登记的模块确实仍是懒加载形态。
    const lazySpecifiers = Array.from(
      new Set(
        ALL_REQUIRES.filter((item) => item.kind === "lazy").map(
          (item) => item.specifier,
        ),
      ),
    );

    for (const specifier of Object.keys(KNOWN_LAZY_UNRESOLVED)) {
      expect(lazySpecifiers).toContain(specifier);
    }
  });
});

const describeWithNpm = fs.existsSync(NPM_DIR) ? describe : describe.skip;

describeWithNpm(
  "miniprogram_npm 解析一致性（需先在开发者工具执行「构建 npm」）",
  () => {
    const unresolvable = Array.from(
      new Set(
        ALL_REQUIRES.filter(
          (item) => !resolvesInMiniprogramNpm(item.specifier),
        ).map((item) => item.specifier),
      ),
    );

    it("加载期裸包名 require 全部能在 miniprogram_npm 下解析", () => {
      const broken = ALL_REQUIRES.filter(
        (item) =>
          item.kind === "load-time" &&
          !resolvesInMiniprogramNpm(item.specifier),
      ).map((item) => `${item.file}:${item.line} require("${item.specifier}")`);

      expect(broken).toEqual([]);
    });

    it("解析不到的裸包名必须全部是懒加载形态", () => {
      for (const specifier of unresolvable) {
        const kinds = new Set(
          ALL_REQUIRES.filter((item) => item.specifier === specifier).map(
            (item) => item.kind,
          ),
        );
        expect({ specifier, kinds: Array.from(kinds) }).toEqual({
          specifier,
          kinds: ["lazy"],
        });
      }
    });

    it("解析不到的懒加载模块必须在 KNOWN_LAZY_UNRESOLVED 显式登记原因", () => {
      expect(unresolvable.sort()).toEqual(
        Object.keys(KNOWN_LAZY_UNRESOLVED).sort(),
      );
    });

    it("每条登记原因写清楚了（防止用空字符串占位绕过评审）", () => {
      const tooShort = Object.keys(KNOWN_LAZY_UNRESOLVED).filter(
        (specifier) => KNOWN_LAZY_UNRESOLVED[specifier].trim().length <= 20,
      );

      expect(tooShort).toEqual([]);
    });
  },
);
