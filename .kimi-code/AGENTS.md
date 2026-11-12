# deda-wechat-app 项目指令（微信小程序）

## 联调契约（消费方）

1. 接口契约唯一真相是 deda-server 的实现 + Swagger（/api/docs）+
   MINI_PROGRAM_API.md；跨仓联调口径以 deda-server/docs/integration.md 为准。
   任何接口调用必须能在 MINI_PROGRAM_API.md 中找到，且 payload、response、
   字段类型逐项对齐。
2. 统一响应信封 { code, message, data }，code=0 为成功；
   401 由 request.ts 全局处理重登录；deviceId 是业务 ID 不是数据库 UUID；
   时间字段一律 ISO 8601；字段命名 camelCase。

## 前端工程规则

3. 只把 .ts 当源码：改代码只改 .ts/.wxml/.wxss/.json，改完必须运行
   npm run build（palette:sync + tsc）重新生成 .js，否则微信开发者工具
   看不到变化。绝不手改 .js 编译产物。
   **merge / rebase / checkout 之后同样必须重跑 npm run build**——这些操作只刷新
   .ts 的 mtime，.js 仍是旧的，开发者工具里跑的就是旧代码且毫无报错提示。
   `npm run guard:artifacts`（scripts/check-artifacts.js）会检出 MISSING（从未构建）
   与 STALE（.js 早于 .ts）两类问题，已纳入 pre-commit，修复方式只有 `npm run build`。
   例外：`scripts/*.js` 是仓库跟踪的手写构建脚本，不是 tsc 产物；
   guard:no-js 与 CI 的 diff 门禁都只作用于 `miniprogram/` 下的 `.js` 与 `.runtime/`，
   两处作用域必须保持一致（CI 曾用无作用域的 `\.js$` 误杀 scripts 改动）。
4. 颜色唯一来源是 miniprogram/styles/palette.wxss，业务代码禁止出现直接色值；
   改色板后跑 npm run palette:sync && npm run palette:check。
   注意 styles/palette.ts 是 sync-palette.js 的**生成物**，不要手改；
   改生成格式时必须保持 prettier 兼容，否则每次 build 都会把它改脏。
5. 页面改动涉及导航参数、onLoad 兜底、API 调用载荷时，必须通过对应的
   \*.page.spec.ts（page-harness 测试基座）；新页面要补装配用例。

## npm 依赖的模块解析铁律

6. **出货代码禁止在模块顶层 require 裸包名**（`import x from "pkg"` /
   `import x = require("pkg")` / 顶层裸 `require("pkg")`）。
   微信运行时只认 `miniprogram/miniprogram_npm`，而开发者工具「构建 npm」
   仅按包 package.json 的 `main` 字段打包，子路径入口（如
   `@arms/js-sdk/miniapp`）不会生成 → 加载期抛
   `module 'utils/@arms/js-sdk/miniapp.js' is not defined`（错误里的 `utils/`
   前缀就是微信回退到调用方目录做相对解析的痕迹）→ 沿 import 链
   炸穿 request.ts / app.ts → `App()` 从未执行 → 所有页面
   `has not been registered yet` + 组件全部解析成 `wx://not-found` → 整站白屏。
   必须改走「函数内 + try/catch」懒加载并整体降级为 no-op。
7. 这类缺陷 **jest 永远抓不到**：Node 解析器能在 node_modules 里找到子路径文件，
   全套测试绿灯而真机白屏。约束由 `miniprogram/tests/npm-artifacts.spec.ts`
   静态焊死（TS AST 判定 require 位置语义）；解析不到却仍要保留的懒加载依赖，
   必须在该文件的 `KNOWN_LAZY_UNRESOLVED` 里登记原因，白名单只减不增。
   该 spec 的 miniprogram_npm 相关用例在目录缺失时整体 skip（CI 不跑「构建 npm」）。
8. ARMS 监控现状：`config/monitor.config.ts` 的 `ARMS_PID` 为空字符串，
   监控整体静默降级，`utils/monitor.ts` 三个出口（hookApp/reportError/reportApi）
   全部 no-op。**`@arms/js-sdk` 已从 package.json 移除**：它的「构建 npm」产物
   只有 89KB 浏览器 BrowserLogger（含 `window`），小程序里既用不到也跑不了，
   而真正需要的子路径 `miniapp.js` 本来就不会被生成。类型由
   `types/arms-js-sdk.d.ts` 的环境声明提供，tsc 不依赖该包真实安装。
   正式启用 ARMS 需三步：① 装回依赖 ② 补 vendor 打包
   （`@arms/js-sdk/miniapp` 闭包 11 文件 / 59KB，需 browserify 打成单文件放进
   `miniprogram/vendor/`，并在 .gitignore 加 `!miniprogram/vendor/` 豁免，
   否则会被 `miniprogram/**/*.js` 与 guard:no-js 一起剔掉）③ 填入 `ARMS_PID`；
   完成后移除 `tests/npm-artifacts.spec.ts` 里 `KNOWN_LAZY_UNRESOLVED` 的对应条目。

## 测试硬性要求

9. TDD 模式为强制要求（见全局铁律第 5 条）：新功能与缺陷修复先补测试再实现。
10. unit 与 integration 测试合计覆盖率必须 ≥ 90%。
    每次变更后主动跑覆盖率并汇报结果；低于 90% 的变更不得交付。
    覆盖率统计命令：`npx jest --coverage`（已确认为本仓库基座口径）。
    **实测基线（2026-11-12）**：全仓 Stmts 75.69% / Branch 68.14% /
    Funcs 73.36% / Lines 77.12%，尚未达标；缺口集中在
    `pages/switch-mode/switch-mode.ts` 21.73%、`pages/learning-data/learning-data.utils.ts` 54.83%、
    `pages/sleep-manage/sleep-manage.ts` 55%、`api/api.ts` 56.46%、
    `pages/owner-info/owner-info.ts` 61.42%。全仓补齐 90% 属独立议题，需单独排期；
    在此之前，**新增与改动的文件一律要求 ≥90%**（`utils/monitor.ts` 现为 100%）。

## 子任务验收命令（多代理协作协议第 3 条锚点）

主代理审查子代理产出时，必须亲自运行：
`npm run build`（palette:sync + tsc）通过 + `npm run guard:artifacts` 通过 +
`jest` 全部通过 + `npm run palette:check` 通过。
等价的一键命令是 `npm run pre-commit`（tsc --noEmit + guard:artifacts + jest），
但它不含 palette:check 与 build，需另行补跑。
