// 测试侧 any 配额（burn-down，只降不升）。
//
// 规则由 repo-tests/any-guard.mjs 执行：
//   - 生产代码不允许 any（不登记白名单）
//   - 测试文件逐文件登记上限；新增 any 即红
//   - 实际数低于上限也红，强制同步下调（否则白名单会腐烂）
//   - 条目对应文件删除或 any 清零，同样红
//
// 目标：白名单清空，全仓零 any。

export const ANY_ALLOWLIST = {
  "miniprogram/app.spec.ts": {
    max: 4,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/components/load-more/load-more.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/about-device/about-device.page.spec.ts": {
    max: 13,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/adventure-story/adventure-story.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/asset-selftest/asset-selftest.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/chat-history/chat-history.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/child-info/child-info.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/child-list/child-list.page.spec.ts": {
    max: 11,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-control/device-control.page.spec.ts": {
    max: 2,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-list/device-list.page.spec.ts": {
    max: 11,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-list/device-list.utils.spec.ts": {
    max: 2,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-provision/device-provision.branches.page.spec.ts": {
    max: 25,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-provision/device-provision.page.spec.ts": {
    max: 8,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/device-setting/device-setting.page.spec.ts": {
    max: 2,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/learning-data/learning-data.page.spec.ts": {
    max: 13,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/login/login.page.spec.ts": {
    max: 2,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/mine/mine.page.spec.ts": {
    max: 3,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/sleep-config/sleep-config.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/sleep-manage/sleep-manage.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/user-manual/user-manual.page.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/pages/user-profile/user-profile.page.spec.ts": {
    max: 2,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/app-routing.spec.ts": {
    max: 2,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/component-harness.ts": {
    max: 16,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/device-unbind.integration.spec.ts": {
    max: 2,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/feedback-gating.integration.spec.ts": {
    max: 1,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/integration-harness.ts": {
    max: 1,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/npm-artifacts.spec.ts": {
    max: 7,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/tests/page-harness.ts": {
    max: 13,
    reason: "测试基座存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/app-assets.spec.ts": {
    max: 4,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/client-info.spec.ts": {
    max: 4,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/monitor.spec.ts": {
    max: 25,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/nav-bar.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/push-subscription.spec.ts": {
    max: 7,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/selected-device.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/user-profile.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/wifi-info.spec.ts": {
    max: 10,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
  "miniprogram/utils/wifi-signal.spec.ts": {
    max: 1,
    reason: "测试用例存量 any，按文件配额 burn-down",
  },
};
