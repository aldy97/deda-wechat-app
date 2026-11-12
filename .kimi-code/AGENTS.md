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
4. 颜色唯一来源是 miniprogram/styles/palette.wxss，业务代码禁止出现直接色值；
   改色板后跑 npm run palette:sync && npm run palette:check。
5. 页面改动涉及导航参数、onLoad 兜底、API 调用载荷时，必须通过对应的
   *.page.spec.ts（page-harness 测试基座）；新页面要补装配用例。

## 测试硬性要求

6. TDD 模式为强制要求（见全局铁律第 5 条）：新功能与缺陷修复先补测试再实现。
7. unit 与 integration 测试合计覆盖率必须 ≥ 90%。
   每次变更后主动跑覆盖率并汇报结果；低于 90% 的变更不得交付。
   （覆盖率统计命令以本仓库测试基座为准，执行时先确认。）
