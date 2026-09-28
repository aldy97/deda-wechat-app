"use strict";
/**
 * 页面装配测试基座。
 *
 * 小程序 Page({...}) 在模块加载时调用全局 Page,wx 是全局对象;
 * 在 node 环境桩掉它们,即可捕获页面配置、直接驱动 onLoad/onXxx 生命周期,
 * 断言「调了哪个 API、带什么参、导航到哪个 URL」——覆盖 utils 单测
 * 与后端契约测试都照不到的「导航参数 + 页面装配」层。
 *
 * 用法（每个 spec 文件）：
 *   const mockApi = { getXxx: jest.fn(), ... };
 *   jest.mock("../../api/api", () => mockApi);
 *   const harness = installPageHarness();
 *   require("../some-page/some-page"); // 触发 Page() 捕获
 *   const page = harness.createInstance();
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPageHarness = installPageHarness;
function installPageHarness() {
  const wxStub = {
    navigateTo: jest.fn(),
    switchTab: jest.fn(),
    navigateBack: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    showToast: jest.fn(),
    setStorageSync: jest.fn(),
    getStorageSync: jest.fn().mockReturnValue(""),
    stopPullDownRefresh: jest.fn(),
  };
  globalThis.wx = wxStub;
  let captured = null;
  globalThis.Page = jest.fn((config) => {
    captured = config;
  });
  return {
    wx: wxStub,
    getPageConfig: () => captured,
    createInstance: () => {
      var _a;
      if (!captured) {
        throw new Error("未捕获到 Page 配置,请先 require 页面模块");
      }
      const instance = Object.create(null);
      Object.assign(instance, captured);
      // 绑定所有方法到实例，确保异步/嵌套调用中 this 始终指向 instance
      for (const key of Object.keys(instance)) {
        if (typeof instance[key] === "function") {
          instance[key] = instance[key].bind(instance);
        }
      }
      instance.data = JSON.parse(
        JSON.stringify(
          (_a = captured.data) !== null && _a !== void 0 ? _a : {},
        ),
      );
      instance.setData = jest.fn((patch, cb) => {
        var _a, _b, _c;
        for (const [key, value] of Object.entries(patch)) {
          if (key.includes(".")) {
            const [top, ...rest] = key.split(".");
            const leaf = rest.pop();
            let node =
              (_a = instance.data[top]) !== null && _a !== void 0 ? _a : {};
            for (const part of rest)
              node = (_b = node[part]) !== null && _b !== void 0 ? _b : {};
            node[leaf] = value;
            instance.data[top] =
              (_c = instance.data[top]) !== null && _c !== void 0 ? _c : node;
          } else {
            instance.data[key] = value;
          }
        }
        if (typeof cb === "function") cb();
      });
      return instance;
    },
  };
}
