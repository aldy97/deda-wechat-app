# Deda 微信原生小程序 + TypeScript 脚手架

一套最小化的微信原生小程序项目模板，使用 TypeScript 开发，UI 组件库采用 Vant Weapp。项目仅包含基础页面骨架、静态 UI 与模拟数据，所有接口请求统一封装在 `miniprogram/api/api.ts` 中，后续可直接替换为真实 HTTPS 接口。

## 技术栈

- 微信原生小程序（WXML + WXSS + TypeScript）
- Vant Weapp 组件库（按需引入）
- 微信开发者工具内置 TypeScript 编译

## 项目结构

```
deda-wechat-app/
├── package.json                          # npm 依赖
├── tsconfig.json                         # TypeScript 配置
├── project.config.json                   # 微信开发者工具项目配置
├── project.private.config.json           # 开发者工具私有配置
├── README.md                             # 本文件
└── miniprogram/
    ├── app.ts                            # 小程序入口
    ├── app.json                          # 全局配置与页面路由
    ├── app.wxss                          # 全局样式
    ├── sitemap.json                      # 搜索索引配置
    ├── api/
    │   └── api.ts                        # 接口封装（当前为模拟数据）
    ├── utils/
    │   ├── date.ts                       # 日期格式化工具
    │   └── pagination.ts                 # 分页工具函数
    └── pages/
        ├── login/                        # 登录页
        ├── device-list/                  # 设备列表页
        ├── device-control/               # 设备控制面板页
        └── learning-data/                # 学习数据 & 对话记录页
```

## 页面说明

| 页面 | 路径 | 功能 |
|------|------|------|
| 登录页 | `pages/login/login` | 手机号 + 验证码登录骨架 |
| 设备列表页 | `pages/device-list/device-list` | 设备卡片列表、空状态、下拉刷新 |
| 设备控制面板页 | `pages/device-control/device-control` | 电源开关、音量、模式选择 |
| 学习数据 & 对话记录页 | `pages/learning-data/learning-data` | 数据看板、对话记录分页、日期选择 |

## Mac 环境导入与运行步骤

### 1. 安装微信开发者工具

访问微信官方下载页面，下载并安装 **Mac 版微信开发者工具 Stable 版本**：

https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 安装项目依赖

打开终端，进入项目根目录：

```bash
cd /Users/xiong/Desktop/deda-wechat-app
npm install
```

### 3. 导入项目到微信开发者工具

1. 打开微信开发者工具。
2. 点击左侧菜单「小程序」→「+」或顶部菜单「项目」→「导入项目」。
3. 在弹出的文件选择器中，选择项目根目录 `/Users/xiong/Desktop/deda-wechat-app`。
4. **AppID**：
   - 如果你有真实的小程序 AppID，直接填写。
   - 如果仅用于本地预览，选择「测试号」即可。
5. 点击「确定」导入项目。

### 4. 构建 npm

由于 Vant Weapp 通过 npm 引入，需要在开发者工具中执行一次构建：

1. 点击顶部菜单「工具」。
2. 选择「构建 npm」。
3. 等待构建完成，工具会自动生成 `miniprogram/miniprogram_npm/@vant/weapp` 目录。

> 若构建失败，请检查 `project.config.json` 中是否包含 `"nodeModules": true` 与 `"miniprogramRoot": "miniprogram"`（本模板已配置）。

### 5. 预览与热更新

1. 导入并构建成功后，左侧模拟器会自动渲染首页。
2. 修改任意 `.ts`、`.wxml`、`.wxss`、`.json` 文件并保存，开发者工具会自动重新编译，模拟器实时刷新。
3. 点击工具栏「预览」按钮，可生成二维码，使用微信扫码在真机上体验。

## 后续迭代建议

1. **替换真实接口**：修改 `miniprogram/api/api.ts` 中的函数实现，将 `mockDelay` + 模拟数据替换为 `wx.request` 调用后端 HTTPS 接口。
2. **扩展页面功能**：在现有骨架基础上补充表单校验、设备绑定、学习报告图表、对话详情等。
3. **状态管理**：当页面增多时，可引入全局状态管理（如 MobX、全局 `globalData` 或自定义 Store）。
4. **代码规范**：可配置 ESLint + Prettier 统一代码风格。

## 注意事项

- 本项目为最小脚手架，未接入真实后端，所有数据均为模拟。
- 登录页提交后会将 `token` 写入本地缓存，实际项目中应配合后端鉴权。
- 微信开发者工具需使用较新版本，建议 libVersion 不低于 `3.0.0`。
- `project.config.json` 已开启 `"useCompilerPlugins": ["typescript"]`，开发者工具会自动将 `.ts` 编译为 `.js`。若你的开发者工具版本较旧不支持该插件，可手动执行 `npx tsc` 生成 `.js` 文件后再导入。
